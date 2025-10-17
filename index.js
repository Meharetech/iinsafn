const express = require('express');
require("dotenv").config();
const cors = require('cors')
const app = express();
const connectDB = require('./config/dbConnection')
const adsAdminRoute = require('./routes/adminRoutes/advertismentAdmin/adminAdvertismentRoutes')
const userRoutes = require('./routes/userRoutes/userRoutes')
const advertiserRoutes = require("./routes/userAdvertiserRoutes/advertiserRoutes")
const reporterRoutes = require("./routes/reporterRoutes/reporterFetchAds")
const reporterAdminRoutes = require('./routes/adminRoutes/reporterAdmin/adminReporterRoutes')
const adminAuth = require('./routes/adminRoutes/adminAuth/adminAuth') 
const raiseYourVoiceRoutes = require("./routes/RaiseYourVoice/raiseYourVoiceRoutes")
const adminRaiseYourVoice = require("./routes/adminRoutes/adminRaiseYourVoice/raiseYourVoiceStatus")
const pressConferenceRoutes = require("./routes/pressConferenceRoutes/pressConferenceRoutes")
const podcastAuthRoutes = require("./routes/podcastRoutes/podcastAuthRoutes")
const podcastStudioRoutes = require("./routes/podcastRoutes/podcastStudioRoutes")
const podcastBookingRoutes = require("./routes/podcastRoutes/podcastBookingRoutes")
const podcastStudioAdminRoutes = require("./routes/adminRoutes/podcastStudioAdminRoutes")
const podcastBookingAdminRoutes = require("./routes/adminRoutes/podcastBookingAdminRoutes")
const path = require('path')
const multerErrorHandler = require('./middlewares/multer/errorHandler')

// Configure JSON parsing with increased limit
app.use(express.json({ limit: '300mb' })); 

// Configure URL-encoded data parsing with increased limit
app.use(express.urlencoded({ limit: '300mb', extended: true }));

// Configure CORS for production - allow all origins
app.use(cors({
    origin: true,  // Allow all origins
    methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS", "PATCH"],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With', 'timeout'],
    credentials: true
}))



try{
    connectDB()
    app.use('/upload', express.static(path.join(__dirname,'upload')))
    app.use('/uploads', express.static(path.join(__dirname,'uploads')))
    app.use('/images', express.static(path.join(__dirname,'images')))

    // Apply multer error handler middleware
    app.use(multerErrorHandler)
    
    // Root route to show server is running
    app.get('/', (req, res) => {
        res.json({
            message: 'IINSAF Server is running successfully!',
            status: 'OK',
            timestamp: new Date().toISOString(),
            version: '1.0.0'
        });
    });
    
    //Routes
    app.use(adsAdminRoute)
    app.use(userRoutes)
    app.use(advertiserRoutes)
    app.use(reporterRoutes)
    app.use(reporterAdminRoutes)
    app.use(adminAuth)
    app.use(raiseYourVoiceRoutes)
    app.use(adminRaiseYourVoice)
    app.use(pressConferenceRoutes)
    app.use('/podcast', podcastAuthRoutes)
    app.use('/podcast', podcastStudioRoutes)
    app.use('/podcast', podcastBookingRoutes)
    app.use('/admin', podcastStudioAdminRoutes)
    app.use('/admin', podcastBookingAdminRoutes)


    const PORT = process.env.PORT || 5005;
    app.listen(PORT, () => {
      console.log(`Server running at http://localhost:${PORT}`);
    });
}
catch(err)
{
    console.error("Startup Error:", err)
}



