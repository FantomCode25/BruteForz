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
import groq
from collections import defaultdict

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

# Set Groq API key (you need to set this with your own key)
os.environ["GROQ_API_KEY"] = "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"

# Initialize Groq client
groq_client = groq.Groq(api_key=os.getenv("GROQ_API_KEY"))

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
def notify_external_service(name, photo_url):
    try:
        if not name or not name.strip():
            print("Error: Username cannot be empty")
            return False
            
        # Prepare payload
        payload = {
            "username": name.strip(),
            "photo_url": photo_url or ""
        }
        
        # Log the request details
        print(f"Sending notification to external service with payload: {payload}")
        
        # Send request with JSON payload and proper headers
        response = requests.post(
            "https://lbq629b2-5000.inc1.devtunnels.ms/add",
            json=payload,  # Use json parameter instead of data
            headers={
                "Content-Type": "application/json",
                "Accept": "application/json"
            },
            timeout=10  # Add timeout
        )
        
        # Log the response
        print(f"External service response: {response.status_code} - {response.text}")
        
        if response.status_code != 200:
            print(f"External service notification failed: {response.status_code}, {response.text}")
            return False
        
        return True
        
    except requests.exceptions.Timeout:
        print("External service notification timeout")
        return False
    except requests.exceptions.RequestException as e:
        print(f"External service request failed: {str(e)}")
        return False
    except Exception as e:
        print(f"Error notifying external service: {str(e)}")
        traceback.print_exc()
        return False

# Route to add a new contact
@app.route('/api/contacts', methods=['POST'])
def add_contact():
    try:
        contact_data = request.json
        if not contact_data:
            return jsonify({"success": False, "error": "No data provided"}), 400
            
        # Validate required fields
        required_fields = ['name', 'user_id']
        for field in required_fields:
            if not contact_data.get(field):
                return jsonify({"success": False, "error": f"Missing or empty required field: {field}"}), 400
                
        # Clean and validate name
        contact_data['name'] = contact_data['name'].strip()
        if not contact_data['name']:
            return jsonify({"success": False, "error": "Name cannot be empty"}), 400
            
        # Add timestamp and generate ID
        contact_data['timestamp'] = datetime.utcnow()
        contact_data['_id'] = str(uuid4())
        
        # Set default values for optional fields
        contact_data.setdefault('email', "")
        contact_data.setdefault('phone', "")
        contact_data.setdefault('isEmergency', False)
        contact_data.setdefault('photo_url', "")
        contact_data.setdefault('conversation_data', [
            {"text": "Hello", "timestamp": datetime.utcnow().isoformat()},
            {"text": "hi", "timestamp": (datetime.utcnow() + timedelta(seconds=15)).isoformat()}
        ])
        
        # First try to insert into database
        result = contacts_collection.insert_one(contact_data)
        
        # Then notify external service
        notification_result = notify_external_service(
            name=contact_data['name'],
            photo_url=contact_data.get('photo_url', '')
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

# New route to get known persons (contacts) for a patient
@app.route('/api/known-persons/<patient_id>', methods=['GET'])
def get_known_persons(patient_id):
    try:
        contacts = list(contacts_collection.find({"user_id": patient_id}))
        # Transform contacts to known_persons format
        known_persons = []
        for contact in contacts:
            known_persons.append({
                "known_person_id": contact["_id"],
                "name": contact["name"],
                "photo_url": contact.get("photo_url", ""),
                "isEmergency": contact.get("isEmergency", False)
            })
        
        return jsonify({"success": True, "known_persons": known_persons})
    except Exception as e:
        print(f"Error in get_known_persons: {str(e)}")
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500

# Helper function to generate summary from conversations
def generate_summary(conversations, person_name):
    try:
        # Format conversation data for the AI
        formatted_messages = []
        for message in conversations:
            speaker = "Known Person" if person_name else "Contact"
            formatted_messages.append({
                "text": message["text"],
                "speaker": speaker if message.get("from_contact", True) else "You",
                "timestamp": message["timestamp"]
            })
        
        # Create a prompt for summarization
        prompt = f"""
        Please analyze the following conversation between a patient and {person_name} and provide a comprehensive summary.
        
        Focus on:
        1. Main topics discussed
        2. Any important points, questions, or concerns raised
        3. Any actionable items or follow-ups mentioned
        4. The overall tone and nature of the conversation
        
        Format your response with the following sections:
        **Main Topics:** Summarize the key subjects discussed
        **Important Points:** List any significant information shared
        **Action Items:** Note any tasks, follow-ups, or commitments made
        **Relationship Context:** Provide insights about the relationship based on the conversation
        
        Here's the conversation:
        
        {json.dumps(formatted_messages, indent=2)}
        """
        
        # Call Groq API for summarization
        response = groq_client.chat.completions.create(
            model="llama3-70b-8192",  # Using Llama 3 70B model
            messages=[
                {"role": "system", "content": "You are a helpful assistant that summarizes conversations for patients with memory difficulties."},
                {"role": "user", "content": prompt}
            ],
            max_tokens=1000,
            temperature=0.3
        )
        
        # Extract the summary
        summary = response.choices[0].message.content
        return summary
    except Exception as e:
        print(f"Error generating summary: {str(e)}")
        traceback.print_exc()
        return "Unable to generate summary due to an error."

# New route to summarize conversation for a specific date
@app.route('/api/summarize-conversation', methods=['GET'])
def summarize_conversation():
    try:
        patient_id = request.args.get('patient_id')
        known_person_id = request.args.get('known_person_id')
        date_str = request.args.get('date')
        
        if not patient_id or not known_person_id or not date_str:
            return jsonify({
                "success": False,
                "error": "Missing required parameters: patient_id, known_person_id, and date"
            }), 400
        
        # Parse the date
        date = datetime.strptime(date_str, '%Y-%m-%d')
        next_day = date + timedelta(days=1)
        
        # Get the contact document
        contact = contacts_collection.find_one({"_id": known_person_id, "user_id": patient_id})
        
        if not contact:
            # Try with ObjectId if ID looks like one
            if len(known_person_id) == 24 and all(c in '0123456789abcdefABCDEF' for c in known_person_id):
                contact = contacts_collection.find_one({"_id": ObjectId(known_person_id), "user_id": patient_id})
        
        if not contact:
            return jsonify({
                "success": False,
                "summary": "This contact does not exist or doesn't belong to the patient."
            })
        
        # Filter messages for the specified date
        if 'conversation_data' not in contact or not contact['conversation_data']:
            return jsonify({
                "success": False,
                "summary": "No conversation data found for this contact."
            })
            
        # Filter messages for the specified date
        date_messages = []
        for message in contact['conversation_data']:
            try:
                message_time = datetime.fromisoformat(message['timestamp'].replace('Z', '+00:00'))
                if date <= message_time < next_day:
                    date_messages.append(message)
            except (ValueError, TypeError) as e:
                print(f"Error parsing message timestamp: {e}")
                continue
                
        if not date_messages:
            return jsonify({
                "success": False,
                "summary": f"No conversation found for {date_str}.",
                "conversation_count": 0,
                "conversation_length": 0,
                "date": date_str,
                "original_messages": []
            })
            
        # Format messages for display
        formatted_messages = []
        total_length = 0
        for message in date_messages:
            speaker = contact['name'] if message.get('from_contact', True) else "You"
            formatted_messages.append({
                "text": message["text"],
                "speaker": speaker,
                "timestamp": message["timestamp"]
            })
            total_length += len(message["text"])
            
        # Generate summary using Groq
        summary = generate_summary(date_messages, contact['name'])
        
        return jsonify({
            "success": True,
            "summary": summary,
            "conversation_count": len(date_messages),
            "conversation_length": total_length,
            "date": date_str,
            "original_messages": formatted_messages
        })
    except Exception as e:
        print(f"Error in summarize_conversation: {str(e)}")
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500

# New route to summarize all conversations with a known person
@app.route('/api/summarize-all-conversations', methods=['GET'])
def summarize_all_conversations():
    try:
        patient_id = request.args.get('patient_id')
        known_person_id = request.args.get('known_person_id')
        
        if not patient_id or not known_person_id:
            return jsonify({
                "success": False,
                "error": "Missing required parameters: patient_id and known_person_id"
            }), 400
        
        # Get the contact document
        contact = contacts_collection.find_one({"_id": known_person_id, "user_id": patient_id})
        
        if not contact:
            # Try with ObjectId if ID looks like one
            if len(known_person_id) == 24 and all(c in '0123456789abcdefABCDEF' for c in known_person_id):
                contact = contacts_collection.find_one({"_id": ObjectId(known_person_id), "user_id": patient_id})
        
        if not contact:
            return jsonify({
                "success": False,
                "summary": "This contact does not exist or doesn't belong to the patient."
            })
        
        # Check if conversation data exists
        if 'conversation_data' not in contact or not contact['conversation_data']:
            return jsonify({
                "success": False,
                "summary": "No conversation data found for this contact."
            })
            
        # Format messages for display and organize by date
        messages_by_date = defaultdict(list)
        conversation_dates = set()
        total_length = 0
        
        for message in contact['conversation_data']:
            try:
                message_time = datetime.fromisoformat(message['timestamp'].replace('Z', '+00:00'))
                date_str = message_time.strftime('%Y-%m-%d')
                
                speaker = contact['name'] if message.get('from_contact', True) else "You"
                formatted_message = {
                    "text": message["text"],
                    "speaker": speaker,
                    "timestamp": message["timestamp"]
                }
                
                messages_by_date[date_str].append(formatted_message)
                conversation_dates.add(date_str)
                total_length += len(message["text"])
            except (ValueError, TypeError) as e:
                print(f"Error parsing message timestamp: {e}")
                continue
                
        if not messages_by_date:
            return jsonify({
                "success": False,
                "summary": "No valid conversation data found for analysis.",
                "conversation_count": 0,
                "conversation_length": 0
            })
            
        # Sort dates in reverse chronological order
        conversation_dates = sorted(list(conversation_dates), reverse=True)
        
        # Generate a comprehensive summary using Groq
        summary = generate_summary(contact['conversation_data'], contact['name'])
        
        return jsonify({
            "success": True,
            "summary": summary,
            "conversation_count": len(contact['conversation_data']),
            "conversation_length": total_length,
            "messages_by_date": messages_by_date,
            "conversation_dates": conversation_dates
        })
    except Exception as e:
        print(f"Error in summarize_all_conversations: {str(e)}")
        traceback.print_exc()
        return jsonify({"success": False, "error": str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True, port=5000)