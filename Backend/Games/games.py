from flask import Flask, request, jsonify
from flask_cors import CORS
from pymongo import MongoClient
import os
import json
import traceback
from bson import ObjectId
from datetime import datetime


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
except Exception as e:
    print(f"MongoDB connection error: {str(e)}")
    traceback.print_exc()

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

if __name__ == '__main__':
    app.run(debug=True, port=5000)