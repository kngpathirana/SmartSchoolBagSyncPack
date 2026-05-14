# Firebase Realtime Database Setup

This app is already configured for Firebase Realtime Database:

```text
https://smart-school-bag-tracker-default-rtdb.firebaseio.com
```

## 1. Add Database Rules

Open Firebase Console:

```text
Realtime Database -> Rules
```

Paste the rules from `firebase-database-rules.json`, then publish.

These rules are for the prototype/demo app. For a real parent/student app, replace them with authenticated rules before publishing publicly.

## 2. Expected Data Path

The app reads and writes under:

```text
bags/BAG001
```

Example data:

```json
{
  "bags": {
    "BAG001": {
      "telemetry": {
        "battery": 87,
        "isOpen": false,
        "isMoving": false,
        "temperature": 29.4,
        "humidity": 68,
        "tilt": {
          "x": 2,
          "y": 5,
          "z": 88,
          "isTilted": false
        },
        "location": {
          "lat": 6.9271,
          "lng": 79.8612,
          "address": "School"
        }
      },
      "controls": {
        "buzzerMuted": false,
        "buzzerCommand": "unmute"
      },
      "settings": {
        "parent_contacts": [
          {
            "id": "PARENT001",
            "name": "Parent 1",
            "phone": "+94710000000"
          },
          {
            "id": "PARENT002",
            "name": "Parent 2",
            "phone": "+94720000000"
          }
        ]
      },
      "rfid_scans": {
        "RFID-A1B2": "in_bag"
      }
    }
  }
}
```

## 3. SOS SMS Flow

When SOS is pressed, the app writes to:

```text
bags/BAG001/sos_alerts
bags/BAG001/commands
```

The ESP/GSM module or a backend function should read `commands.sosContacts` and `commands.sosMessage`, then send SMS to the parent numbers.
