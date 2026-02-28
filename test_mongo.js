const mongoose = require("mongoose");
require("dotenv").config();

mongoose.connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(async () => {
        console.log("Connected to MongoDB.");
        const PodcastUser = require("./models/podcastUser/podcastUserSchema");
        const email = "rahul9466727218verma@gmail.com";

        console.log("Looking for user with email:", email);
        const user = await PodcastUser.findOne({ email: email });
        console.log("User:", user);

        process.exit(0);
    })
    .catch((err) => {
        console.error("MongoDB error:", err);
        process.exit(1);
    });
