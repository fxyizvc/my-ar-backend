const { MongoClient } = require('mongodb');

const uri = "mongodb+srv://faisvc916_db_user:fayizvc123@cluster0.kqm7txf.mongodb.net/?retryWrites=true&w=majority";
const client = new MongoClient(uri);

export default async function handler(req, res) {
  // 1. Read the new parameters from the URL
  const { lat, lon, subject, branch, semester } = req.query;

  try {
    await client.connect();
    const db = client.db("arProjectDB");

    // --- MODE A: GPS CHECK ---
    if (lat && lon) {
      const collection = db.collection("colleges");
      const documents = await collection.find({}).toArray();

      let minDistance = 500000;
      let nearestCollege = null;
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
              nearestCollege = doc;
            }
          }
        }
      });

      if (nearestCollege && minDistance < 500) {
        res.status(200).json({
          found: true,
          mode: "college_check",
          college_name: nearestCollege.college_name || "Unknown College",
          distance: minDistance
        });
      } else {
        res.status(200).json({ found: false, mode: "college_check", distance: minDistance });
      }
    } 
    
    // --- MODE B: ASSET SEARCH (UPDATED) ---
    else if (subject) {
      const collection = db.collection("assets");

      // Build the Search Query
      let dbQuery = {
        filename: { $regex: subject, $options: 'i' } // Always match name
      };

      // If Unity sends a specific branch (and it's not "All"), filter by it
      if (branch && branch !== "All") {
        dbQuery.branch = branch; 
      }

      // If Unity sends a specific semester (and it's not "All"), filter by it
      if (semester && semester !== "All") {
        dbQuery.semester = semester;
      }

      const asset = await collection.findOne(dbQuery);

      if (asset) {
        res.status(200).json({
          found: true,
          mode: "asset_search",
          filename: asset.filename,
          glb_url: asset.glb_url || "",
          pdf_url: asset.pdf_url || "",
          branch: asset.branch || "",    // Send back for debugging
          semester: asset.semester || "" // Send back for debugging
        });
      } else {
        res.status(200).json({ 
          found: false, 
          mode: "asset_search", 
          error: "No matching subject found for this Branch/Semester." 
        });
      }
    }
    else {
      res.status(400).json({ error: "Provide lat/lon OR subject" });
    }

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}