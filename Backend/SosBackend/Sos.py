from flask import Flask, request, jsonify
from flask_cors import CORS
from pymongo import MongoClient
from pymongo.errors import DuplicateKeyError
import os
from dotenv import load_dotenv
import json
import bcrypt
import re
import time
import uuid
from location_handler import get_current_location
from send_email import send_sos_email

# Load environment variables
load_dotenv()

app = Flask(__name__)
CORS(app, resources={
    r"/api/*": {
        "origins": ["http://localhost:5173"],  # Replace with your frontend URL
        "methods": ["GET", "POST", "PUT", "DELETE"],
        "allow_headers": ["Content-Type", "Authorization"]
    }
})

# MongoDB connection
mongo_uri = "mongodb+srv://bossutkarsh30:YOCczedaElKny6Dd@cluster0.gixba.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"
client = MongoClient(mongo_uri)
db = client["alzheimers_db"]
patients_collection = db["patient"]

# Create an index on email field instead
patients_collection.create_index("email", unique=True)

# Helper function to validate email format
def is_valid_email(email):
    email_regex = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return re.match(email_regex, email) is not None

# Helper function to validate phone number format
def is_valid_phone(phone):
    phone_regex = r'^\+?[0-9]{10,15}$'  # Simple regex for phone validation
    return re.match(phone_regex, phone) is not None

@app.route('/api/signup', methods=['POST'])
def signup():
    data = request.json
    
    # Validate required fields
    required_fields = ['name', 'email', 'password', 'age', 'phone']
    for field in required_fields:
        if field not in data or not data[field]:
            return jsonify({'success': False, 'message': f'Missing required field: {field}'}), 400
    
    # Validate email format
    if not is_valid_email(data['email']):
        return jsonify({'success': False, 'message': 'Invalid email format'}), 400
    
    # Validate phone number
    if not is_valid_phone(data['phone']):
        return jsonify({'success': False, 'message': 'Invalid phone number format'}), 400
    
    # Check if email already exists
    if patients_collection.find_one({'email': data['email']}):
        return jsonify({'success': False, 'message': 'Email already registered'}), 409
    
    # Hash the password
    hashed_password = bcrypt.hashpw(data['password'].encode('utf-8'), bcrypt.gensalt())
    
    # Generate UUID for user_id
    user_id = str(uuid.uuid4())
    
    # Prepare user document
    user = {
        '_id': user_id,  # Use UUID string as _id
        'name': data['name'],
        'email': data['email'],
        'password': hashed_password.decode('utf-8'),  # Store as string
        'age': int(data['age']),
        'phone': data['phone'],
        'date': data.get('date', ''),  # Optional field
    }
    
    # Insert into database
    try:
        result = patients_collection.insert_one(user)
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
    
    # Check required fields
    if not data.get('email') or not data.get('password'):
        return jsonify({'success': False, 'message': 'Email and password are required'}), 400
    
    # Find user by email
    user = patients_collection.find_one({'email': data['email']})
    
    if not user:
        return jsonify({'success': False, 'message': 'User not found'}), 404
    
    # Verify password
    if bcrypt.checkpw(data['password'].encode('utf-8'), user['password'].encode('utf-8')):
        # Return user data (excluding sensitive information)
        user_data = {
            'user_id': user['_id'],  # Use the UUID string directly
            'name': user['name'],
            'email': user['email'],
            'age': user['age'],
            'phone': user['phone']
        }
        return jsonify({'success': True, 'message': 'Login successful', 'user': user_data}), 200
    else:
        return jsonify({'success': False, 'message': 'Invalid password'}), 401

@app.route('/api/sos', methods=['POST'])
def sos():
    try:
        # Get user data from request
        user_data = request.json or {}
        user_id = user_data.get('user_id')
        user_name = user_data.get('name')
        
        # Get user from database using UUID string directly
        user = None
        if user_id:
            try:
                user = patients_collection.find_one({'_id': user_id})
            except Exception as e:
                print(f"Error finding user: {str(e)}")
        
        # If we found a user, use their name and emergency contacts
        if user:
            user_name = user.get('name', user_name)
            emergency_contacts = user.get('emergency_contacts', [])
        else:
            # Default emergency contacts if no user is found
            emergency_contacts = [
                {"name": "Emergency Contact 1", "email": "rsubhashsrinivas@gmail.com"},
                {"name": "Emergency Contact 2", "email": "shashupreethims@gmail.com"},
                {"name": "Caregiver", "email": "bossutkarsh.30@gmail.com"}
            ]
        
        # Get browser location data if provided
        browser_location = user_data.get('location')
        battery_percentage = user_data.get('battery')
        
        # Get current timestamp
        timestamp = time.strftime("%Y-%m-%d %H:%M:%S")
        
        # Get location using browser data if available, otherwise simulate
        location = get_current_location(browser_location, battery_percentage)
        
        # Send emails to all emergency contacts
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