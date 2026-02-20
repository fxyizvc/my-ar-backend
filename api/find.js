// Update: Hologram Carousel Array Fetch
const { MongoClient } = require('mongodb');

const uri = "mongodb+srv://faisvc916_db_user:fayizvc123@cluster0.kqm7txf.mongodb.net/?retryWrites=true&w=majority";
const client = new MongoClient(uri);

export default async function handler(req, res) {
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
    
    // --- MODE B: ASSET SEARCH (CAROUSEL MODE) ---
    else if (subject) {
      const collection = db.collection("assets");

      let dbQuery = {
        // Find any document where filename contains the subject (e.g., "ECT301")
        filename: { $regex: subject, $options: 'i' } 
      };

      // STRICT FILTER: Only return if branch/sem match
      if (branch && branch !== "All") {
        dbQuery.branch = { $regex: new RegExp("^" + branch + "$", "i") };
      }

      if (semester && semester !== "All") {
        dbQuery.semester = { $regex: new RegExp("^" + semester + "$", "i") };
      }

      // 1. Fetch ALL matching modules and sort them alphabetically
      // (This ensures "ECT301_M1" comes before "ECT301_M2")
      const assets = await collection.find(dbQuery).sort({ filename: 1 }).toArray();

      // 2. Return an array of all matched assets
      if (assets.length > 0) {
        res.status(200).json({
          found: true,
          mode: "asset_search",
          assets: assets.map(a => ({
            filename: a.filename,
            glb_url: a.glb_url || "",
            pdf_url: a.pdf_url || "",
            branch: a.branch,
            semester: a.semester
          }))
        });
      } else {
        res.status(200).json({ 
          found: false, 
          mode: "asset_search", 
          error: "No asset found for this Branch/Sem." 
        });
      }
    }
    else {
      res.status(400).json({ error: "Missing parameters" });
    }

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
}