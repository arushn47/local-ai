from flask import Flask, request, Response, jsonify
from flask_cors import CORS
import ollama
import json
import re
import base64
from typing import Dict, Union, List

app = Flask(__name__)
CORS(app)

memory_store = {}
ALLOWED_MODELS = ['llava:latest', 'bakllava:latest', 'deepseek-r1:latest']

@app.route('/chat', methods=['POST'])
def chat_stream():
    data = request.get_json(force=True)
    prompt = data.get('prompt', '')
    # FIX: Changed 'image_b64' to 'file_data' to match the Next.js API route
    file_data = data.get('file_data')
    model_name = data.get('model', 'llava:latest')
    user_id = request.remote_addr

    if not prompt and not file_data:
        error_data = json.dumps({"error": "Prompt or image is required."})
        return Response(f"data: {error_data}\n\n", status=400, mimetype='text/event-stream')

    if model_name not in ALLOWED_MODELS:
        model_name = 'llava:latest'

    chat_history = memory_store.get(user_id, [])
    user_message: Dict[str, Union[str, List[str]]] = {"role": "user", "content": prompt}

    # FIX: Check for 'file_data' to correctly handle the image
    if file_data:
        try:
            # The 'file_data' is already a base64 string without the prefix.
            base64.b64decode(file_data) 
            user_message['images'] = [file_data]
        except Exception:
            error_data = json.dumps({"error": "Invalid base64 image data."})
            return Response(f"data: {error_data}\n\n", status=400, mimetype='text/event-stream')

    chat_history.append(user_message)

    def generate():
        try:
            stream = ollama.chat(
                model=model_name,
                messages=chat_history,
                stream=True
            )

            raw_output = ""
            assistant_message_started = False

            for chunk in stream:
                if 'message' in chunk and 'content' in chunk['message']:
                    token = chunk['message']['content']
                    raw_output += token
                    assistant_message_started = True
                    # Yield each token as it arrives for a smoother stream.
                    yield f"data: {json.dumps({'token': token})}\n\n"

            if not assistant_message_started:
                yield f"data: {json.dumps({'error': 'No output from model.'})}\n\n"
                return

            # Clean the full response for memory storage.
            cleaned_output = re.sub(r"<think>.*?</think>", "", raw_output, flags=re.DOTALL).strip()

            if cleaned_output:
                chat_history.append({"role": "assistant", "content": cleaned_output})
                memory_store[user_id] = chat_history[-10:]

            yield f"data: {json.dumps({'event': 'done'})}\n\n"

        except Exception as e:
            print("Error occurred:", str(e))
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return Response(generate(), mimetype="text/event-stream")

@app.route("/reset", methods=["POST"])
def clear_memory():
    user_id = request.remote_addr
    if user_id in memory_store:
        del memory_store[user_id]
        return jsonify({"message": "Memory reset successful."})
    return jsonify({"message": "No memory found to reset"})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5000, debug=False)
