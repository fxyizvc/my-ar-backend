// api/find.js
const { MongoClient } = require('mongodb');

// Your Connection String
const uri = "mongodb+srv://faisvc916_db_user:fayizvc123@cluster0.kqm7txf.mongodb.net/?retryWrites=true&w=majority";

const client = new MongoClient(uri);

export default async function handler(req, res) {
  const { lat, lon } = req.query;

  if (!lat || !lon) {
    return res.status(400).json({ error: "Missing lat/lon" });
  }

  try {
    await client.connect();
    const db = client.db("arProjectDB");
    
    // ✅ CHANGE 1: Look in 'colleges' collection, not 'assets'
    const collection = db.collection("colleges");

    const documents = await collection.find({}).toArray();

    let minDistance = 500000;
    let nearestDoc = null;

    const userLat = parseFloat(lat);
    const userLon = parseFloat(lon);

    documents.forEach(doc => {
      if (doc.coordinate) {
        const parts = doc.coordinate.split(',');
        if (parts.length >= 2) {
          const dbLat = parseFloat(parts[0]);
          const dbLon = parseFloat(parts[1]);

          const R = 6371000; 
          const dLat = (dbLat - userLat) * (Math.PI / 180);
          const dLon = (dbLon - userLon) * (Math.PI / 180);
          const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
                    Math.cos(userLat * (Math.PI / 180)) * Math.cos(dbLat * (Math.PI / 180)) *
                    Math.sin(dLon / 2) * Math.sin(dLon / 2);
          const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
          const distance = R * c;

          if (distance < minDistance) {
            minDistance = distance;
            nearestDoc = doc;
          }
        }
      }
    });

    if (nearestDoc && minDistance < 500) {
      res.status(200).json({
        found: true,
        // ✅ CHANGE 2: Read 'college_name' OR 'filename' (Matches your DB)
        subject: nearestDoc.college_name || nearestDoc.filename || "Unknown",
        glb: nearestDoc.glb_url || "",
        pdf: nearestDoc.pdf_url || "",
        distance: minDistance
      });
    } else {
      res.status(200).json({
        found: false,
        distance: minDistance
      });
    }

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}