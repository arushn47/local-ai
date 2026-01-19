from flask import Flask, request, Response, jsonify
from flask_cors import CORS
import ollama
import json
import re
import base64
import os
from typing import Dict, Union, List, Optional, Any, Mapping
from supabase import create_client, Client

app = Flask(__name__)
CORS(app)

# Initialize Supabase client
SUPABASE_URL = os.environ.get('SUPABASE_URL') or os.environ.get('NEXT_PUBLIC_SUPABASE_URL')
SUPABASE_KEY = os.environ.get('SUPABASE_SERVICE_KEY') or os.environ.get('NEXT_PUBLIC_SUPABASE_ANON_KEY')

supabase: Optional[Client] = None
if SUPABASE_URL and SUPABASE_KEY:
    try:
        supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
        # Set schema to localmind
        supabase.postgrest.schema('localmind')
        print(f"[Supabase] Connected to {SUPABASE_URL}")
    except Exception as e:
        print(f"[Supabase] Failed to connect: {e}")
else:
    print("[Supabase] No credentials found, using in-memory storage only")

# In-memory fallback stores (used when Supabase is unavailable)
memory_store: Dict[str, List[Dict]] = {}
summary_store: Dict[str, str] = {}
image_store: Dict[str, List[str]] = {}

# Configuration
ALLOWED_MODELS = ['llava:latest', 'bakllava:latest', 'deepseek-r1:8b', 'llama3.2-vision:latest', 'qwen3-vl:8b', 'deepseek-r1:latest', 'qwen2.5:7b-instruct']
MAX_HISTORY_MESSAGES = 20
MAX_CONTENT_LENGTH = 4000
SUMMARIZE_THRESHOLD = 16
KEEP_RECENT_MESSAGES = 8
MAX_IMAGES_IN_HISTORY = 2
SUMMARY_MODEL = 'qwen2.5:7b-instruct'

# JARVIS-style system prompt - makes all models identify as LocalMind
LOCALMIND_SYSTEM_PROMPT = """You are LocalMind, a sophisticated AI assistant created by Arush. You are NOT ChatGPT, Claude, Llama, Qwen, or any other AI. You are LocalMind.

Personality:
- Speak in a professional but warm manner, like a personal butler or JARVIS from Iron Man
- Use phrases like "Certainly, sir", "Right away", "Of course", "As you wish"
- Be concise and helpful
- When asked who made you, say "I am LocalMind, created by Arush"
- When asked what you are, say "I am LocalMind, your personal AI assistant"

Capabilities:
- You can help with tasks, answer questions, write code, and have conversations
- You have access to tools like calendar, email, tasks, notes, and web search
- You remember context from the conversation

Always be helpful, accurate, and maintain the LocalMind identity."""

# Voice mode prompt - for short, conversational responses
LOCALMIND_VOICE_PROMPT = """You are LocalMind, an AI assistant created by Arush, currently in VOICE CONVERSATION mode.

CRITICAL RULES FOR VOICE MODE:
- Keep responses SHORT - 1-3 sentences maximum
- Be conversational and natural, like talking to a friend
- Use phrases like "Sure!", "Got it!", "Of course, sir", "Right away"
- Do NOT include code blocks, lists, or formatted text
- Do NOT write long explanations - just give the key answer
- If asked to elaborate, you can give more detail
- Speak naturally as if having a real conversation

Example responses:
- "Sure! The capital of France is Paris."
- "Got it, sir. I've noted that down for you."
- "Of course! Here's a quick joke: Why did the scarecrow win an award? Because he was outstanding in his field!"

Remember: This is a voice conversation - keep it brief and natural."""

def truncate_content(content: str, max_length: int = MAX_CONTENT_LENGTH) -> str:
    """Truncate content to prevent token overflow from very long messages."""
    if len(content) <= max_length:
        return content
    return content[:max_length] + "... [truncated]"

def get_user_id_from_chat(chat_id: str) -> Optional[str]:
    """Get the user_id for a chat from Supabase."""
    if not supabase:
        return None
    try:
        result = supabase.from_('chats').select('user_id').eq('id', chat_id).single().execute()
        data: Any = getattr(result, "data", None)

        # Supabase may return dict-like JSON, a list of rows, or other JSON primitives depending on settings.
        user_id_value: Any = None
        if isinstance(data, Mapping):
            user_id_value = data.get('user_id')
        elif isinstance(data, list) and data and isinstance(data[0], Mapping):
            user_id_value = data[0].get('user_id')

        if user_id_value is None:
            return None
        if isinstance(user_id_value, str):
            return user_id_value
        return str(user_id_value)
    except Exception as e:
        print(f"[Supabase] Error getting user_id for chat {chat_id}: {e}")
        return None

def load_summary_from_db(user_id: str) -> str:
    """Load conversation summary from Supabase memories table."""
    if not supabase or not user_id:
        return summary_store.get(user_id, "")
    
    try:
        result = supabase.from_('memories').select('content').eq('user_id', user_id).order('importance', desc=True).order('created_at', desc=True).limit(1).execute()
        data: Any = getattr(result, "data", None)

        content_value: Any = None
        if isinstance(data, list) and data and isinstance(data[0], Mapping):
            content_value = data[0].get('content', '')
        elif isinstance(data, Mapping):
            content_value = data.get('content', '')

        if content_value is None:
            return ""
        if isinstance(content_value, str):
            return content_value
        return str(content_value)
    except Exception as e:
        print(f"[Supabase] Error loading memory for user {user_id}: {e}")
        return summary_store.get(user_id, "")

def save_summary_to_db(user_id: str, summary: str, importance: int = 1) -> bool:
    """Save conversation summary to Supabase memories table."""
    if not supabase or not user_id:
        summary_store[user_id] = summary
        return True
    
    try:
        # Upsert memory (update if exists, insert if not)
        # First try to find existing memory
        existing = supabase.from_('memories').select('id').eq('user_id', user_id).limit(1).execute()
        existing_data: Any = getattr(existing, "data", None)

        existing_id: Optional[str] = None
        if isinstance(existing_data, list) and existing_data and isinstance(existing_data[0], Mapping):
            row_id = existing_data[0].get('id')
            if row_id is not None:
                existing_id = str(row_id)

        if existing_id:
            # Update existing memory
            supabase.from_('memories').update({
                'content': summary,
                'importance': importance
            }).eq('id', existing_id).execute()
        else:
            # Insert new memory
            supabase.from_('memories').insert({
                'user_id': user_id,
                'content': summary,
                'importance': importance
            }).execute()
        
        # Also keep in local cache
        summary_store[user_id] = summary
        print(f"[Supabase] Saved memory for user {user_id}")
        return True
    except Exception as e:
        print(f"[Supabase] Error saving memory: {e}")
        summary_store[user_id] = summary
        return False

def summarize_conversation(messages: List[Dict]) -> str:
    """Use a fast model to summarize older messages into a context summary."""
    if not messages:
        return ""
    
    conv_text = "\n".join([
        f"{msg['role'].upper()}: {msg['content'][:500]}" 
        for msg in messages
    ])
    
    try:
        response = ollama.chat(
            model=SUMMARY_MODEL,
            messages=[{
                "role": "user",
                "content": f"""Summarize this conversation in 2-3 sentences, focusing on key topics and any important information the user shared:

{conv_text}

Summary:"""
            }],
            stream=False
        )
        summary = response['message']['content'].strip()
        print(f"[Summarize] Generated summary: {summary[:100]}...")
        return summary
    except Exception as e:
        print(f"[Summarize] Error: {e}")
        return f"Previous conversation covered: {', '.join([m['content'][:50] for m in messages[:3]])}..."

def get_smart_history(chat_id: str, user_id: Optional[str] = None) -> List[Dict]:
    """
    Get conversation history with smart compression.
    - If history is long, older messages are summarized
    - Returns a mix of summary context + recent messages
    """
    history = memory_store.get(chat_id, [])
    
    # Try to get existing summary from DB if user is authenticated
    if user_id:
        existing_summary = load_summary_from_db(user_id)
    else:
        existing_summary = summary_store.get(chat_id, "")
    
    # If history exceeds threshold, summarize old messages
    if len(history) > SUMMARIZE_THRESHOLD:
        print(f"[History] Chat {chat_id} has {len(history)} messages, triggering summarization")
        
        messages_to_summarize = history[:-KEEP_RECENT_MESSAGES]
        recent_messages = history[-KEEP_RECENT_MESSAGES:]
        
        new_summary = summarize_conversation(messages_to_summarize)
        
        if existing_summary:
            combined_summary = f"{existing_summary} {new_summary}"
            if len(combined_summary) > 1000:
                combined_summary = combined_summary[-1000:]
        else:
            combined_summary = new_summary
        
        # Save summary to database if user is authenticated
        if user_id:
            save_summary_to_db(user_id, combined_summary, importance=2)
        else:
            summary_store[chat_id] = combined_summary
        
        memory_store[chat_id] = recent_messages
        
        context_message = {
            "role": "system",
            "content": f"[Previous conversation context: {combined_summary}]"
        }
        return [context_message] + recent_messages
    
    if existing_summary:
        context_message = {
            "role": "system", 
            "content": f"[Previous conversation context: {existing_summary}]"
        }
        return [context_message] + history[-MAX_HISTORY_MESSAGES:]
    
    return history[-MAX_HISTORY_MESSAGES:]

def store_image(chat_id: str, image_data: str) -> None:
    """Store image in history, keeping only last MAX_IMAGES_IN_HISTORY."""
    if chat_id not in image_store:
        image_store[chat_id] = []
    
    image_store[chat_id].append(image_data)
    image_store[chat_id] = image_store[chat_id][-MAX_IMAGES_IN_HISTORY:]
    print(f"[Images] Stored image for {chat_id}, total: {len(image_store[chat_id])}")

def get_recent_images(chat_id: str) -> List[str]:
    """Get recent images for context."""
    return image_store.get(chat_id, [])

@app.route('/chat', methods=['POST'])
def chat_stream():
    data = request.get_json(force=True)
    prompt = data.get('prompt', '')
    file_data = data.get('file_data')
    model_name = data.get('model', 'llama3.2-vision:latest')
    chat_id = data.get('chat_id', request.remote_addr)

    print(f"\n[Chat] chat_id: {chat_id}, model: {model_name}")
    print(f"[Chat] Prompt: {prompt[:100]}..." if len(prompt) > 100 else f"[Chat] Prompt: {prompt}")
    print(f"[Chat] Has image: {bool(file_data)}")

    if not prompt and not file_data:
        error_data = json.dumps({"error": "Prompt or image is required."})
        return Response(f"data: {error_data}\n\n", status=400, mimetype='text/event-stream')

    if model_name not in ALLOWED_MODELS:
        model_name = 'llama3.2-vision:latest'

    # Get user_id for this chat (for memory persistence)
    user_id = get_user_id_from_chat(chat_id)
    
    # Get SMART history (with possible summarization)
    chat_history = get_smart_history(chat_id, user_id)
    print(f"[Chat] History messages loaded: {len(chat_history)}")

    user_message_for_api: Dict[str, Union[str, List[str]]] = {"role": "user", "content": prompt}
    user_message_for_storage: Dict[str, str] = {"role": "user", "content": truncate_content(prompt)}

    if file_data:
        image_base64 = None
        
        # Check if file_data is a URL (from Supabase Storage) or base64
        if file_data.startswith('http://') or file_data.startswith('https://'):
            try:
                import requests
                print(f"[Chat] Fetching image from URL...")
                response = requests.get(file_data, timeout=30)
                if response.status_code == 200:
                    image_base64 = base64.b64encode(response.content).decode('utf-8')
                    print(f"[Chat] Image fetched and converted to base64")
                else:
                    print(f"[Chat] Failed to fetch image: HTTP {response.status_code}")
            except Exception as e:
                print(f"[Chat] Error fetching image from URL: {e}")
        elif file_data.startswith('data:'):
            # Handle data URL format (data:image/jpeg;base64,...)
            try:
                image_base64 = file_data.split(',')[1]
                base64.b64decode(image_base64)  # Validate
                print(f"[Chat] Extracted base64 from data URL")
            except Exception as e:
                print(f"[Chat] Error parsing data URL: {e}")
        else:
            # Assume it's already base64
            try:
                base64.b64decode(file_data)
                image_base64 = file_data
            except Exception:
                print(f"[Chat] Invalid base64 image data")

        if image_base64:
            store_image(chat_id, image_base64)
            user_message_for_api['images'] = [image_base64]
            user_message_for_storage['content'] = truncate_content(f"[Image attached] {prompt}")
        else:
            print(f"[Chat] Could not process image, continuing without it")
    else:
        recent_images = get_recent_images(chat_id)
        if recent_images and 'vision' in model_name.lower():
            user_message_for_api['images'] = [recent_images[-1]]
            print(f"[Chat] Including recent image in context")

    messages_for_api = [
        {"role": "system", "content": LOCALMIND_SYSTEM_PROMPT}
    ] + chat_history + [user_message_for_api]
    
    # Check if this is voice mode - use shorter responses
    voice_mode = data.get('voice_mode', False)
    if voice_mode:
        # Prepend voice mode instructions for short, conversational responses
        messages_for_api[0]["content"] = LOCALMIND_VOICE_PROMPT
        print(f"[Chat] Voice mode enabled - using short response prompt")
    
    print(f"[Chat] Total messages being sent to model: {len(messages_for_api)} (including system prompt)")

    def generate():
        try:
            stream = ollama.chat(
                model=model_name,
                messages=messages_for_api,
                stream=True
            )

            raw_output = ""
            assistant_message_started = False

            for chunk in stream:
                if 'message' in chunk and 'content' in chunk['message']:
                    token = chunk['message']['content']
                    raw_output += token
                    assistant_message_started = True
                    yield f"data: {json.dumps({'token': token})}\n\n"

            if not assistant_message_started:
                yield f"data: {json.dumps({'error': 'No output from model.'})}\n\n"
                return

            cleaned_output = re.sub(r"<think>.*?</think>", "", raw_output, flags=re.DOTALL).strip()

            if cleaned_output:
                if chat_id not in memory_store:
                    memory_store[chat_id] = []
                
                memory_store[chat_id].append(user_message_for_storage)
                memory_store[chat_id].append({
                    "role": "assistant", 
                    "content": truncate_content(cleaned_output)
                })
                
                print(f"[Chat] Stored history for {chat_id}: {len(memory_store[chat_id])} messages")

            yield f"data: {json.dumps({'event': 'done'})}\n\n"

        except Exception as e:
            error_msg = str(e)
            print(f"[Chat] Error: {error_msg}")
            yield f"data: {json.dumps({'error': error_msg})}\n\n"

    return Response(generate(), mimetype="text/event-stream")

@app.route("/reset", methods=["POST"])
def clear_memory():
    """Reset memory for a specific chat or all chats."""
    data = request.get_json(force=True) if request.data else {}
    chat_id = data.get('chat_id')
    
    if chat_id:
        cleared = False
        if chat_id in memory_store:
            del memory_store[chat_id]
            cleared = True
        if chat_id in summary_store:
            del summary_store[chat_id]
            cleared = True
        if chat_id in image_store:
            del image_store[chat_id]
            cleared = True
        
        if cleared:
            print(f"[Reset] Cleared all memory for chat: {chat_id}")
            return jsonify({"message": f"Memory reset for chat {chat_id}."})
        return jsonify({"message": "No memory found for this chat."})
    else:
        user_id = request.remote_addr
        cleared = []
        for store in [memory_store, summary_store, image_store]:
            for key in list(store.keys()):
                if key.startswith(user_id) or key == user_id:
                    del store[key]
                    if key not in cleared:
                        cleared.append(key)
        if cleared:
            print(f"[Reset] Cleared memory for: {cleared}")
            return jsonify({"message": f"Memory reset for {len(cleared)} chat(s)."})
        return jsonify({"message": "No memory found to reset."})

@app.route("/stats", methods=["GET"])
def get_stats():
    """Get memory statistics."""
    chat_id = request.args.get('chat_id')
    
    if chat_id:
        return jsonify({
            "chat_id": chat_id,
            "messages": len(memory_store.get(chat_id, [])),
            "has_summary": chat_id in summary_store,
            "images_stored": len(image_store.get(chat_id, [])),
            "supabase_connected": supabase is not None
        })
    
    return jsonify({
        "total_chats": len(memory_store),
        "total_summaries": len(summary_store),
        "total_image_contexts": len(image_store),
        "supabase_connected": supabase is not None
    })

@app.route("/health", methods=["GET"])
def health_check():
    """Health check endpoint."""
    return jsonify({
        "status": "healthy",
        "supabase_connected": supabase is not None
    })

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=False)
