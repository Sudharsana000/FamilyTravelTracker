import express from "express";
import bodyParser from "body-parser";
import mongoose from "mongoose";
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// MongoDB connection
mongoose.connect(process.env.MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => console.log("Connected to MongoDB Atlas"))
  .catch(err => console.log("Error connecting to MongoDB: ", err));

// Define Mongoose schemas
const userSchema = new mongoose.Schema({
  name: String,
  color: String
});

const countrySchema = new mongoose.Schema({
  country_code: String,
  country_name: String
});

const visitedCountrySchema = new mongoose.Schema({
  country_code: String,
  user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User' }
});

const User = mongoose.model("User", userSchema);
const VisitedCountry = mongoose.model("VisitedCountry", visitedCountrySchema);

app.use(bodyParser.urlencoded({ extended: true }));
app.use(express.static("public"));

// Middleware for the selected user (similar to `currentUserId`)
let currentUserId = null;

async function checkVisited() {
  const countries = await VisitedCountry.find({ user_id: currentUserId }).select('country_code');
  return countries.map(c => c.country_code);
}

async function getCurrentUser() {
  return await User.findById(currentUserId);
}

app.get("/", async (req, res) => {
  const countries = await checkVisited();
  const currentUser = await getCurrentUser();
  const users = await User.find();
  
  res.render("index.ejs", {
    countries,
    total: countries.length,
    users,
    color: currentUser ? currentUser.color : 'black',
  });
});

const Country = mongoose.model('Country', countrySchema);

// Function to fetch country code based on user input
async function fetchCountryCode(countryName) {
  try {
    // Convert the input to title case to match the database records
    const formattedCountryName = countryName.trim().toLowerCase().replace(/\b\w/g, char => char.toUpperCase());

    // Search the database for the country name
    const country = await Country.findOne({ country_name: countryName });

    // Check if country was found
    if (country) {
      return { country_code: country.country_code };
    } else {
      return { error: `Country "${countryName}" not found.` };
    }
  } catch (error) {
    console.error('Error fetching country code:', error.message);
    return { error: error.message };
  }
}

// Route to insert a new visited country for the current user
app.post("/add", async (req, res) => {
  const input = req.body["country"];
  try {
    const data = await fetchCountryCode(input);
    
    // If no valid country code is returned, do not proceed with the insertion
    if (data.country_code) {
      await VisitedCountry.create({ country_code: data.country_code, user_id: currentUserId });
    } else {
      console.log(data.error); // Log error message if country not found
    }

    // Redirect back to the main page regardless of whether the insertion was successful
    res.redirect("/");
  } catch (err) {
    console.log(err);
    res.redirect("/");
  }
});

// Insert a new country for the current user
app.post("/add", async (req, res) => {
  const input = req.body["country"];
  try {
    const data = await fetchCountryCode(input);
    const countryCode = data.country_code;
    await VisitedCountry.create({ country_code: countryCode, user_id: currentUserId });
    res.redirect("/");
  } catch (err) {
    console.log(err);
    res.redirect("/");
  }
});

// Change user context or add a new user
app.post("/user", async (req, res) => {
  if (req.body.add === "new") {
    res.render("new.ejs");
  } else {
    currentUserId = req.body.user;
    res.redirect("/");
  }
});

app.post("/new", async (req, res) => {
  const { name, color } = req.body;
  const newUser = new User({ name, color });
  await newUser.save();
  currentUserId = newUser._id;
  res.redirect("/");
});

app.listen(port, () => {
  console.log(`Server running on http://localhost:${port}`);
});
