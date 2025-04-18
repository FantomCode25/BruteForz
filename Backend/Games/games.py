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
from apscheduler.schedulers.background import BackgroundScheduler
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
import smtplib

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
    routines_collection = db["routines"]
    medication_reminders_collection = db["medications"]
except Exception as e:
    print(f"MongoDB connection error: {str(e)}")
    traceback.print_exc()

# Initialize the scheduler
scheduler = BackgroundScheduler()
scheduler.start()

# Helper function to send email notifications
def send_email(to_email, subject, body):
    try:
        # email_address = os.getenv("EMAIL_ADDRESS") or "your_email@example.com"
        # email_password = os.getenv("EMAIL_PASSWORD") or "your_email_password"
        
        email_address = "echomind.reminder@gmail.com"
        email_password = "wjap csdz xrxb aknz"

        print(f"Using email address: {email_address}")
        print("Connecting to SMTP server...")

        msg = MIMEMultipart()
        msg['From'] = email_address
        msg['To'] = to_email
        msg['Subject'] = subject

        msg.attach(MIMEText(body, 'plain'))

        with smtplib.SMTP('smtp.gmail.com', 587) as server:
            server.starttls()
            server.login(email_address, email_password)
            server.send_message(msg)
        print(f"Email sent to {to_email}")
    except Exception as e:
        print(f"SMTP connection error: {str(e)}")

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

# Helper function to check and send reminders
def check_and_send_reminder(reminder):
    """Helper function to check if it's time to send a reminder"""
    try:
        current_time = datetime.now()
        scheduled_time = reminder['date_time']
        
        # Calculate time difference in seconds
        time_diff = abs((current_time - scheduled_time).total_seconds())
        
        # Check if within 10-second window
        if time_diff <= 10:
            send_email(
                reminder['email'],
                f"Medication Reminder: {reminder['name']}",
                f"Time to take your medication: {reminder['name']}\n"
                f"Dosage: {reminder['dosage']}\n"
                f"Instructions: {reminder['instruction']}"
            )
            return True
        return False
    except Exception as e:
        print(f"Error checking reminder: {str(e)}")
        return False

# Add new function to send missed medication reminder
def send_missed_medication_reminder(reminder):
    try:
        # Check if the medication has been marked as completed
        current_reminder = medication_reminders_collection.find_one({'_id': reminder['_id']})
        
        if current_reminder and current_reminder.get('status') == 'pending':
            # Send missed medication email
            send_email(
                reminder['email'],
                f"⚠️ Missed Medication Alert: {reminder['name']}",
                f"IMPORTANT: You have missed your scheduled medication:\n\n"
                f"Medication: {reminder['name']}\n"
                f"Dosage: {reminder['dosage']}\n"
                f"Instructions: {reminder['instruction']}\n\n"
                f"This medication was scheduled for: {reminder['date_time'].strftime('%Y-%m-%d %H:%M:%S')}\n\n"
                f"Please take your medication as soon as possible and consult your healthcare provider if needed."
            )
            
            # Update reminder status to missed
            medication_reminders_collection.update_one(
                {'_id': reminder['_id']},
                {'$set': {'status': 'missed'}}
            )
            
            print(f"Sent missed medication alert for reminder {reminder['_id']}")
            
    except Exception as e:
        print(f"Error sending missed medication reminder: {str(e)}")

# Route to create a medication reminder
@app.route('/api/medication-reminders', methods=['POST'])
def create_medication_reminder():
    try:
        data = request.json
        required_fields = ['name', 'dosage', 'instruction', 'date_time', 'frequency', 'email']
        for field in required_fields:
            if not data.get(field):
                return jsonify({'success': False, 'message': f'Missing required field: {field}'}), 400

        # Parse and validate the reminder date-time using system time
        reminder_time = datetime.strptime(data['date_time'], '%Y-%m-%d %H:%M:%S')
        current_time = datetime.now()
        
        # Check if reminder time is within valid range
        if reminder_time < current_time:
            return jsonify({'success': False, 'message': 'Reminder date-time must be in the future'}), 400

        # Save the reminder to the database with status field
        reminder = {
            'name': data['name'],
            'dosage': data['dosage'],
            'instruction': data['instruction'],
            'date_time': reminder_time,
            'frequency': data['frequency'],
            'email': data['email'],
            'created_at': current_time,
            'status': 'pending',  # Add status field
            'completed_at': None  # Add completed_at field
        }
        result = medication_reminders_collection.insert_one(reminder)

        # Schedule both the initial reminder and the missed medication check
        reminder_id = str(result.inserted_id)
        
        # Schedule initial reminder
        scheduler.add_job(
            func=check_and_send_reminder,
            trigger='interval',
            seconds=10,
            args=[reminder],
            id=f"{reminder_id}_check"
        )

        # Schedule missed medication reminder
        scheduler.add_job(
            func=send_missed_medication_reminder,
            trigger='date',
            run_date=reminder_time + timedelta(seconds=30),
            args=[reminder],
            id=f"{reminder_id}_missed"
        )

        print(f"Scheduled reminder check job: {reminder_id} for {reminder_time}")

        return jsonify({
            'success': True, 
            'message': 'Medication reminder created successfully', 
            'reminder_id': reminder_id
        }), 201
        
    except Exception as e:
        print(f"Error creating medication reminder: {str(e)}")
        return jsonify({'success': False, 'message': f'Failed to create medication reminder: {str(e)}'}), 500

# Route to update a medication reminder
@app.route('/api/medication-reminders/<reminder_id>', methods=['PUT'])
def update_medication_reminder(reminder_id):
    try:
        data = request.json
        update_fields = {}
        if 'name' in data:
            update_fields['name'] = data['name']
        if 'dosage' in data:
            update_fields['dosage'] = data['dosage']
        if 'instruction' in data:
            update_fields['instruction'] = data['instruction']
        if 'date_time' in data:
            reminder_time = datetime.strptime(data['date_time'], '%Y-%m-%d %H:%M:%S')
            if reminder_time < datetime.utcnow():
                return jsonify({'success': False, 'message': 'Reminder date-time must be in the future'}), 400
            update_fields['date_time'] = reminder_time
        if 'frequency' in data:
            if data['frequency'] not in ['daily', 'weekly', 'monthly']:
                return jsonify({'success': False, 'message': 'Invalid frequency. Choose from daily, weekly, or monthly'}), 400
            update_fields['frequency'] = data['frequency']
        if 'email' in data:
            update_fields['email'] = data['email']

        # Update the reminder in the database
        result = medication_reminders_collection.update_one({'_id': ObjectId(reminder_id)}, {'$set': update_fields})
        if result.matched_count == 0:
            return jsonify({'success': False, 'message': 'Reminder not found'}), 404

        # Reschedule the email notification if date_time or frequency is updated
        if 'date_time' in update_fields or 'frequency' in update_fields:
            scheduler.remove_job(reminder_id)

            # Determine the new schedule
            if update_fields.get('frequency', data.get('frequency')) == 'daily':
                trigger = 'interval'
                interval = {'days': 1}
            elif update_fields.get('frequency', data.get('frequency')) == 'weekly':
                trigger = 'interval'
                interval = {'weeks': 1}
            elif update_fields.get('frequency', data.get('frequency')) == 'monthly':
                reminder_time = update_fields.get('date_time', reminder_time)
                trigger = 'cron'
                interval = {'day': reminder_time.day, 'hour': reminder_time.hour, 'minute': reminder_time.minute}

            scheduler.add_job(
                func=send_email,
                trigger=trigger,
                **interval,
                args=[
                    update_fields.get('email', data['email']),
                    f"Updated Medication Reminder: {update_fields.get('name', data['name'])}",
                    f"Time to take your medication: {update_fields.get('name', data['name'])} (Dosage: {update_fields.get('dosage', data['dosage'])})\nInstructions: {update_fields.get('instruction', data['instruction'])}"
                ],
                id=reminder_id
            )

        return jsonify({'success': True, 'message': 'Medication reminder updated successfully'}), 200
    except Exception as e:
        print(f"Error updating medication reminder: {str(e)}")
        return jsonify({'success': False, 'message': f'Failed to update medication reminder: {str(e)}'}), 500

# Route to delete a medication reminder
@app.route('/api/medication-reminders/<reminder_id>', methods=['DELETE'])
def delete_medication_reminder(reminder_id):
    try:
        # Delete the reminder from the database
        result = medication_reminders_collection.delete_one({'_id': ObjectId(reminder_id)})
        if result.deleted_count == 0:
            return jsonify({'success': False, 'message': 'Reminder not found'}), 404

        # Remove the scheduled job
        scheduler.remove_job(reminder_id)

        return jsonify({'success': True, 'message': 'Medication reminder deleted successfully'}), 200
    except Exception as e:
        print(f"Error deleting medication reminder: {str(e)}")
        return jsonify({'success': False, 'message': f'Failed to delete medication reminder: {str(e)}'}), 500

# Route to mark medication as taken
@app.route('/api/medication-reminders/<reminder_id>/complete', methods=['POST'])
def mark_medication_taken(reminder_id):
    try:
        # Update the reminder status
        result = medication_reminders_collection.update_one(
            {'_id': ObjectId(reminder_id)},
            {
                '$set': {
                    'status': 'completed',
                    'completed_at': datetime.now()
                }
            }
        )
        
        if result.matched_count == 0:
            return jsonify({'success': False, 'message': 'Reminder not found'}), 404

        # Remove the scheduled missed medication job since it's been taken
        try:
            scheduler.remove_job(f"{reminder_id}_missed")
        except Exception as e:
            print(f"Warning: Could not remove missed medication job: {str(e)}")

        return jsonify({
            'success': True,
            'message': 'Medication marked as taken successfully'
        })
        
    except Exception as e:
        print(f"Error marking medication as taken: {str(e)}")
        return jsonify({'success': False, 'message': str(e)}), 500

# Update the get_medication_reminders route to include status
@app.route('/api/medication-reminders', methods=['GET'])
def get_medication_reminders():
    try:
        reminders = list(medication_reminders_collection.find({}, {
            "_id": 1, 
            "name": 1, 
            "dosage": 1, 
            "instruction": 1, 
            "date_time": 1, 
            "frequency": 1, 
            "email": 1,
            "status": 1,
            "completed_at": 1
        }))
        
        # Convert ObjectId to string and adjust times to local time
        for reminder in reminders:
            reminder["_id"] = str(reminder["_id"])
            if reminder.get("date_time"):
                reminder["date_time"] = reminder["date_time"].strftime('%Y-%m-%d %H:%M:%S')
            if reminder.get("completed_at"):
                reminder["completed_at"] = reminder["completed_at"].strftime('%Y-%m-%d %H:%M:%S')
                
        return jsonify({"success": True, "reminders": reminders}), 200
    except Exception as e:
        print(f"Error fetching medication reminders: {str(e)}")
        return jsonify({"success": False, "message": f"Failed to fetch medication reminders: {str(e)}"}), 500

# Route to create a routine
@app.route('/api/routines', methods=['POST'])
def create_routine():
    try:
        data = request.json
        required_fields = ['title', 'description', 'scheduled_time', 'patient_name', 'frequency', 'email']
        for field in required_fields:
            if not data.get(field):
                return jsonify({'success': False, 'message': f'Missing required field: {field}'}), 400

        # Parse and validate the scheduled_time
        scheduled_time = datetime.strptime(data['scheduled_time'], '%Y-%m-%d %H:%M:%S')
        if scheduled_time < datetime.utcnow():
            return jsonify({'success': False, 'message': 'Scheduled time must be in the future'}), 400

        # Validate frequency
        if data['frequency'] not in ['hourly', 'weekly', 'monthly']:
            return jsonify({'success': False, 'message': 'Invalid frequency. Choose from hourly, weekly, or monthly'}), 400

        # Save the routine to the database
        routine = {
            'title': data['title'],
            'description': data['description'],
            'scheduled_time': scheduled_time,
            'patient_name': data['patient_name'],
            'created_at': datetime.utcnow(),
            'frequency': data['frequency'],
            'email': data['email']
        }
        result = routines_collection.insert_one(routine)

        # Schedule email notifications
        schedule_routine_email(routine, str(result.inserted_id))

        # Send confirmation email
        send_email(
            data['email'],
            f"Routine Created: {data['title']}",
            f"Your routine '{data['title']}' has been created and scheduled for {scheduled_time}."
        )

        return jsonify({'success': True, 'message': 'Routine created successfully', 'routine_id': str(result.inserted_id)}), 201
    except Exception as e:
        print(f"Error creating routine: {str(e)}")
        return jsonify({'success': False, 'message': f'Failed to create routine: {str(e)}'}), 500

# Helper function to schedule routine email notifications
def schedule_routine_email(routine, routine_id):
    try:
        if routine['frequency'] == 'hourly':
            trigger = 'interval'
            interval = {'hours': 1}
        elif routine['frequency'] == 'weekly':
            trigger = 'interval'
            interval = {'weeks': 1}
        elif routine['frequency'] == 'monthly':
            trigger = 'cron'
            interval = {'day': routine['scheduled_time'].day, 'hour': routine['scheduled_time'].hour, 'minute': routine['scheduled_time'].minute}

        scheduler.add_job(
            func=send_email,
            trigger=trigger,
            **interval,
            args=[
                routine['email'],
                f"Routine Reminder: {routine['title']}",
                f"It's time for your routine: {routine['title']}.\nDescription: {routine['description']}"
            ],
            id=routine_id
        )
    except Exception as e:
        print(f"Error scheduling routine email: {str(e)}")

# Route to get all routines
@app.route('/api/routines', methods=['GET'])
def get_routines():
    try:
        routines = list(routines_collection.find({}, {"_id": 1, "title": 1, "description": 1, "scheduled_time": 1, "patient_name": 1, "frequency": 1, "email": 1, "created_at": 1}))
        for routine in routines:
            routine["_id"] = str(routine["_id"])  # Convert ObjectId to string
        return jsonify({'success': True, 'routines': routines}), 200
    except Exception as e:
        print(f"Error fetching routines: {str(e)}")
        return jsonify({'success': False, 'message': f'Failed to fetch routines: {str(e)}'}), 500

# Route to update a routine
@app.route('/api/routines/<routine_id>', methods=['PUT'])
def update_routine(routine_id):
    try:
        data = request.json
        update_fields = {}
        if 'title' in data:
            update_fields['title'] = data['title']
        if 'description' in data:
            update_fields['description'] = data['description']
        if 'scheduled_time' in data:
            scheduled_time = datetime.strptime(data['scheduled_time'], '%Y-%m-%d %H:%M:%S')
            if scheduled_time < datetime.utcnow():
                return jsonify({'success': False, 'message': 'Scheduled time must be in the future'}), 400
            update_fields['scheduled_time'] = scheduled_time
        if 'frequency' in data:
            if data['frequency'] not in ['hourly', 'weekly', 'monthly']:
                return jsonify({'success': False, 'message': 'Invalid frequency. Choose from hourly, weekly, or monthly'}), 400
            update_fields['frequency'] = data['frequency']
        if 'patient_name' in data:
            update_fields['patient_name'] = data['patient_name']
        if 'email' in data:
            update_fields['email'] = data['email']

        # Update the routine in the database
        result = routines_collection.update_one({'_id': ObjectId(routine_id)}, {'$set': update_fields})
        if result.matched_count == 0:
            return jsonify({'success': False, 'message': 'Routine not found'}), 404

        # Reschedule email notifications if necessary
        if 'scheduled_time' in update_fields or 'frequency' in update_fields:
            scheduler.remove_job(routine_id)
            updated_routine = routines_collection.find_one({'_id': ObjectId(routine_id)})
            schedule_routine_email(updated_routine, routine_id)

        return jsonify({'success': True, 'message': 'Routine updated successfully'}), 200
    except Exception as e:
        print(f"Error updating routine: {str(e)}")
        return jsonify({'success': False, 'message': f'Failed to update routine: {str(e)}'}), 500

# Route to delete a routine
@app.route('/api/routines/<routine_id>', methods=['DELETE'])
def delete_routine(routine_id):
    try:
        # Delete the routine from the database
        result = routines_collection.delete_one({'_id': ObjectId(routine_id)})
        if result.deleted_count == 0:
            return jsonify({'success': False, 'message': 'Routine not found'}), 404

        # Remove the scheduled job
        scheduler.remove_job(routine_id)

        return jsonify({'success': True, 'message': 'Routine deleted successfully'}), 200
    except Exception as e:
        print(f"Error deleting routine: {str(e)}")
        return jsonify({'success': False, 'message': f'Failed to delete routine: {str(e)}'}), 500

if __name__ == '__main__':
    try:
        # Enable CORS for development
        CORS(app, resources={
            r"/api/*": {
                "origins": ["http://localhost:5173", "http://127.0.0.1:5173"],
                "methods": ["GET", "POST", "PUT", "DELETE"],
                "allow_headers": ["Content-Type"]
            }
        })
        
        print("Starting Flask server on http://localhost:5000")
        app.run(host='0.0.0.0', port=5000, debug=True)
    except Exception as e:
        print(f"Server failed to start: {str(e)}")
        traceback.print_exc()