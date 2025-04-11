from flask import Flask, request, jsonify
from flask_cors import CORS
from pymongo import MongoClient
import os
import json
import traceback
from bson import ObjectId
from datetime import datetime, timedelta
from uuid import uuid4
import base64
import requests
from werkzeug.utils import secure_filename

# Custom JSON encoder to handle ObjectId
class MongoJSONEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, ObjectId):
            return str(obj)
        if isinstance(obj, datetime):
            return obj.isoformat()
        return super().default(obj)

# Initialize Flask app
app = Flask(__name__)
CORS(app)  # Enable CORS for all routes
app.json_encoder = MongoJSONEncoder

# Set ImgBB API key
os.environ["IMGBB_API_KEY"] = "ae2817b2ebddd8b0160555cc377b8ff9"

# Connect to MongoDB
mongo_uri = "mongodb+srv://bossutkarsh30:YOCczedaElKny6Dd@cluster0.gixba.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0"
try:
    client = MongoClient(mongo_uri)
    # Test the connection
    client.admin.command('ping')
    print("MongoDB connection successful!")
    db = client["alzheimers_db"]
    patients_collection = db["patient"]
    games_collection = db["games"]
    contacts_collection = db["contacts"]
except Exception as e:
    print(f"MongoDB connection error: {str(e)}")
    traceback.print_exc()

# New route to handle image uploads
@app.route('/api/upload-image', methods=['POST'])
def upload_image():
    try:
        if 'image' not in request.files:
            return jsonify({"success": False, "error": "No image file provided"}), 400
            
        file = request.files['image']
        
        if file.filename == '':
            return jsonify({"success": False, "error": "No selected file"}), 400
            
        if file:
            # Read the file data
            file_data = file.read()
            # Convert to base64
            img_base64 = base64.b64encode(file_data).decode('utf-8')
            
            # Get API key from environment variable
            imgbb_api_key = os.getenv("IMGBB_API_KEY")
            if not imgbb_api_key:
                return jsonify({"success": False, "error": "ImgBB API key not configured"}), 500
                
            # Upload to ImgBB
            response = requests.post(
                "https://api.imgbb.com/1/upload",
                data={
                    "key": imgbb_api_key,
                    "image": img_base64,
                }
            )
            
            if response.status_code != 200:
                return jsonify({"success": False, "error": f"ImgBB API error: {response.status_code}"}), 500
                
            # Get the URL from the response
            result = response.json()
            if result.get('success'):
                return jsonify({
                    "success": True,
                    "imageUrl": result.get('data', {}).get('url')
                })
            else:
                return jsonify({"success": False, "error": "ImgBB upload failed"}), 500
                
    except Exception as e:
        print(f"Error in upload_image: {str(e)}")
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500

# Route to get all patients
@app.route('/api/patients', methods=['GET'])
def get_patients():
    try:
        patients = list(patients_collection.find({}, {"password": 0}))
        return jsonify({"success": True, "patients": patients})
    except Exception as e:
        print(f"Error in get_patients: {str(e)}")
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500

# Route to get patient by ID
@app.route('/api/patients/<patient_id>', methods=['GET'])
def get_patient(patient_id):
    try:
        # First try to find patient using the ID directly (for UUID)
        patient = patients_collection.find_one({"_id": patient_id}, {"password": 0})
        
        # If not found and ID looks like an ObjectId, try with ObjectId
        if not patient and len(patient_id) == 24 and all(c in '0123456789abcdefABCDEF' for c in patient_id):
            patient = patients_collection.find_one({"_id": ObjectId(patient_id)}, {"password": 0})
            
        if patient:
            return jsonify({"success": True, "patient": patient})
        return jsonify({"success": False, "error": "Patient not found"}), 404
    except Exception as e:
        print(f"Error in get_patient: {str(e)}")
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500

# Route to save game score to the Games collection
@app.route('/api/games', methods=['POST'])
def save_game_score():
    try:
        print("Received request to save game score")
        game_data = request.json
        print(f"Game data: {game_data}")
        
        required_fields = ['patient_id', 'game_name', 'score']
        
        for field in required_fields:
            if field not in game_data:
                return jsonify({"success": False, "error": f"Missing required field: {field}"}), 400
        
        # Add timestamp
        game_data['timestamp'] = datetime.utcnow()
        
        # Get patient information to store name
        patient_id = game_data['patient_id']
        patient_name = None
        
        # Try to find patient in the database to get their name
        try:
            # First try direct match (for UUID)
            patient = patients_collection.find_one({"_id": patient_id})
            
            # If not found and ID looks like an ObjectId, try with ObjectId
            if not patient and len(patient_id) == 24 and all(c in '0123456789abcdefABCDEF' for c in patient_id):
                patient = patients_collection.find_one({"_id": ObjectId(patient_id)})
                
            if patient and 'name' in patient:
                patient_name = patient['name']
        except Exception as e:
            print(f"Warning: Could not fetch patient name: {str(e)}")
            # Continue even if we couldn't get the name
        
        # Store patient name if available
        if patient_name:
            game_data['patient_name'] = patient_name
            
        # Keep patient_id as string - don't convert to ObjectId for UUID
        # This works with both UUID and ObjectId formats
        
        # Insert game score
        result = games_collection.insert_one(game_data)
        
        return jsonify({
            "success": True, 
            "message": "Score saved successfully",
            "game_id": str(result.inserted_id)
        })
    except Exception as e:
        print(f"Error in save_game_score: {str(e)}")
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500

# Route to get game scores for a patient
@app.route('/api/games/<patient_id>', methods=['GET'])
def get_game_scores(patient_id):
    try:
        game = request.args.get('game', None)
        
        # First try exact match (for UUID)
        query = {"patient_id": patient_id}
        
        # If patient_id looks like ObjectId, try with both formats
        if len(patient_id) == 24 and all(c in '0123456789abcdefABCDEF' for c in patient_id):
            try:
                object_id = ObjectId(patient_id)
                query = {"$or": [{"patient_id": patient_id}, {"patient_id": object_id}]}
            except:
                pass
        
        if game:
            if "$or" in query:
                query = {"$and": [query, {"game_name": game}]}
            else:
                query["game_name"] = game
            
        scores = list(games_collection.find(query).sort("timestamp", -1))
        return jsonify({"success": True, "games": scores})
    except Exception as e:
        print(f"Error in get_game_scores: {str(e)}")
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500
    
@app.route('/api/contacts/<user_id>', methods=['GET'])
def get_contacts(user_id):
    try:
        contacts = list(contacts_collection.find({"user_id": user_id}))
        return jsonify({"success": True, "contacts": contacts})
    except Exception as e:
        print(f"Error in get_contacts: {str(e)}")
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500

# Helper function to notify external service about new contact
# Helper function to notify external service about new contact
def notify_external_service(name, photo_url):
    try:
        # Send POST request to the external endpoint with form data, not JSON
        response = requests.post(
            "https://lbq629b2-5000.inc1.devtunnels.ms/add",
            data={  # Changed from json to data to send as form data
                "username": name,
                "photo_url": photo_url
            }
        )
        
        if response.status_code != 200:
            print(f"External service notification failed: {response.status_code}, {response.text}")
            return False
        
        print(f"External service notification succeeded: {response.text}")
        return True
    except Exception as e:
        print(f"Error notifying external service: {str(e)}")
        traceback.print_exc()
        return False
        
# Route to add a new contact
@app.route('/api/contacts', methods=['POST'])
def add_contact():
    try:
        contact_data = request.json
        
        # Check for required fields - name and user_id are required
        required_fields = ['name', 'user_id']
        
        for field in required_fields:
            if field not in contact_data:
                return jsonify({"success": False, "error": f"Missing required field: {field}"}), 400
        
        # Add timestamp and generate ID if not provided
        contact_data['timestamp'] = datetime.utcnow()
        if '_id' not in contact_data:
            contact_data['_id'] = str(uuid4())
        
        # Ensure optional fields exist even if empty
        if 'email' not in contact_data:
            contact_data['email'] = ""
        if 'phone' not in contact_data:
            contact_data['phone'] = ""
        if 'isEmergency' not in contact_data:
            contact_data['isEmergency'] = False
        if 'photo_url' not in contact_data:
            contact_data['photo_url'] = ""
        if 'conversation_data' not in contact_data:
            # Default conversation data
            contact_data['conversation_data'] = [
                {"text": "Hello", "timestamp": datetime.utcnow().isoformat()},
                {"text": "hi", "timestamp": (datetime.utcnow() + timedelta(seconds=15)).isoformat()}
            ]
        
        # Insert contact
        result = contacts_collection.insert_one(contact_data)
        
        # After successfully adding the contact to database, notify external service
        notification_result = notify_external_service(
            name=contact_data['name'],
            photo_url=contact_data['photo_url']
        )
        
        return jsonify({
            "success": True, 
            "message": "Contact added successfully",
            "contact_id": str(result.inserted_id),
            "external_notification": "succeeded" if notification_result else "failed"
        })
    except Exception as e:
        print(f"Error in add_contact: {str(e)}")
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500

# Route to delete a contact
@app.route('/api/contacts/<contact_id>', methods=['DELETE'])
def delete_contact(contact_id):
    try:
        # First try to delete contact using the ID directly (for UUID)
        result = contacts_collection.delete_one({"_id": contact_id})
        
        # If not found and ID looks like an ObjectId, try with ObjectId
        if result.deleted_count == 0 and len(contact_id) == 24 and all(c in '0123456789abcdefABCDEF' for c in contact_id):
            result = contacts_collection.delete_one({"_id": ObjectId(contact_id)})
            
        if result.deleted_count == 0:
            return jsonify({"success": False, "error": "Contact not found"}), 404
            
        return jsonify({"success": True, "message": "Contact deleted successfully"})
    except Exception as e:
        print(f"Error in delete_contact: {str(e)}")
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500

# Route to update a contact
@app.route('/api/contacts/<contact_id>', methods=['PUT'])
def update_contact(contact_id):
    try:
        contact_data = request.json
        
        # First try to update contact using the ID directly (for UUID)
        result = contacts_collection.update_one(
            {"_id": contact_id},
            {"$set": contact_data}
        )
        
        # If not found and ID looks like an ObjectId, try with ObjectId
        if result.matched_count == 0 and len(contact_id) == 24 and all(c in '0123456789abcdefABCDEF' for c in contact_id):
            result = contacts_collection.update_one(
                {"_id": ObjectId(contact_id)},
                {"$set": contact_data}
            )
            
        if result.matched_count == 0:
            return jsonify({"success": False, "error": "Contact not found"}), 404
            
        return jsonify({"success": True, "message": "Contact updated successfully"})
    except Exception as e:
        print(f"Error in update_contact: {str(e)}")
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)