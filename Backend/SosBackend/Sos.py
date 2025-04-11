from flask import Flask, request, jsonify
from flask_cors import CORS
from pymongo import MongoClient
from pymongo.errors import DuplicateKeyError
import os
from dotenv import load_dotenv
import bcrypt
import re
import time
import uuid
from datetime import datetime
from location_handler import get_current_location
from send_email import send_sos_email

# Load environment variables
load_dotenv()

app = Flask(__name__)

from flask_cors import CORS

CORS(app, supports_credentials=True, resources={
    r"/api/*": {
        "origins": ["http://localhost:5173", "http://localhost:5174"],
        "methods": ["GET", "POST", "PUT", "DELETE"],
        "allow_headers": ["Content-Type", "Authorization"]
    }
})


# MongoDB setup
mongo_uri = os.getenv("MONGO_URI") or "mongodb+srv://bossutkarsh30:YOCczedaElKny6Dd@cluster0.gixba.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"
client = MongoClient(mongo_uri)
db = client["alzheimers_db"]
patients_collection = db["patient"]
patients_collection.create_index("email", unique=True)  # ensure email uniqueness

# === Helper Functions ===

def is_valid_email(email):
    regex = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return re.match(regex, email)

def is_valid_phone(phone):
    regex = r'^\+?[0-9]{10,15}$'
    return re.match(regex, phone)

# === Routes ===

@app.route('/api/signup', methods=['POST'])
def signup():
    data = request.json

    # Required fields
    required_fields = ['name', 'email', 'password', 'age', 'phone']
    for field in required_fields:
        if not data.get(field):
            return jsonify({'success': False, 'message': f'Missing required field: {field}'}), 400

    if not is_valid_email(data['email']):
        return jsonify({'success': False, 'message': 'Invalid email format'}), 400

    if not is_valid_phone(data['phone']):
        return jsonify({'success': False, 'message': 'Invalid phone number format'}), 400

    if patients_collection.find_one({'email': data['email']}):
        return jsonify({'success': False, 'message': 'Email already registered'}), 409

    hashed_password = bcrypt.hashpw(data['password'].encode('utf-8'), bcrypt.gensalt())
    user_id = str(uuid.uuid4())

    # ✅ Date is now added correctly here
    user = {
        '_id': user_id,
        'name': data['name'],
        'email': data['email'],
        'password': hashed_password.decode('utf-8'),
        'age': int(data['age']),
        'phone': data['phone'],
        'date': datetime.utcnow().isoformat()  # << Fixed this line
    }

    try:
        patients_collection.insert_one(user)
        return jsonify({
            'success': True,
            'message': 'User registered successfully',
            'user_id': user_id
        }), 201
    except Exception as e:
        return jsonify({'success': False, 'message': f'Registration failed: {str(e)}'}), 500

@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    if not data.get('email') or not data.get('password'):
        return jsonify({'success': False, 'message': 'Email and password are required'}), 400

    user = patients_collection.find_one({'email': data['email']})
    if not user:
        return jsonify({'success': False, 'message': 'User not found'}), 404

    if bcrypt.checkpw(data['password'].encode('utf-8'), user['password'].encode('utf-8')):
        return jsonify({
            'success': True,
            'message': 'Login successful',
            'user': {
                'user_id': user['_id'],
                'name': user['name'],
                'email': user['email'],
                'age': user['age'],
                'phone': user['phone']
            }
        }), 200
    else:
        return jsonify({'success': False, 'message': 'Invalid password'}), 401

@app.route('/api/sos', methods=['POST'])
def sos():
    try:
        user_data = request.json or {}
        user_id = user_data.get('user_id')
        user_name = user_data.get('name')

        user = patients_collection.find_one({'_id': user_id}) if user_id else None
        emergency_contacts = user.get('emergency_contacts', []) if user else [
            {"name": "Emergency Contact 1", "email": "rsubhashsrinivas@gmail.com"},
            {"name": "Emergency Contact 2", "email": "shashupreethims@gmail.com"},
            {"name": "Caregiver", "email": "bossutkarsh.30@gmail.com"}
        ]

        user_name = user.get('name', user_name) if user else user_name
        browser_location = user_data.get('location')
        battery_percentage = user_data.get('battery')
        timestamp = time.strftime("%Y-%m-%d %H:%M:%S")

        location = get_current_location(browser_location, battery_percentage)

        for contact in emergency_contacts:
            send_sos_email(
                recipient_name=contact["name"],
                recipient_email=contact["email"],
                user_name=user_name,
                location=location,
                timestamp=timestamp
            )

        return jsonify({
            "success": True,
            "status": "success",
            "message": "SOS alert sent successfully",
            "location": location,
            "timestamp": timestamp
        }), 200

    except Exception as e:
        print(f"Error processing SOS request: {str(e)}")
        return jsonify({
            "success": False,
            "status": "error",
            "message": f"Failed to process SOS alert: {str(e)}"
        }), 500

if __name__ == '__main__':
    app.run(debug=True, port=8000, host='0.0.0.0')
