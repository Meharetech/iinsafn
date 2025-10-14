const genrateIdCard = require("../../models/reporterIdGenrate/genrateIdCard");

const qrProfile = async (req, res) => {
  try {
    const cardId = req.params.id;
    const reporter = await genrateIdCard.findById(cardId);

    if (!reporter) {
      return res.status(404).send("<h2>Reporter not found</h2>");
    }

    res.send(`
      <html>
        <head>
          <title>Reporter Info</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <style>
            body {
              margin: 0;
              padding: 0;
              width: 100vw;
              height: 100vh;
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              background-color: #fdf6e3; /* creme */
              display: flex;
              justify-content: center;
              align-items: center;
            }
            .card {
              background: #fff8e7;
              padding: 30px 20px;
              border-radius: 15px;
              width: 90%;
              max-width: 450px;
              box-shadow: 0 8px 20px rgba(0, 0, 0, 0.15);
              text-align: center;
              color: #000;
            }
            .reporter-img {
              width: 140px;
              height: 140px;
              object-fit: cover;
              border-radius: 50%;
              border: 4px solid #000; /* black border */
              margin-bottom: 20px;
            }
            h2 {
              color: #000;
              margin-bottom: 15px;
              font-size: 22px;
            }
            p {
              margin: 8px 0;
              font-size: 16px;
              color: #000;
            }
            strong {
              color: #333;
            }

            @media (max-width: 480px) {
              .card {
                padding: 20px 15px;
              }
              .reporter-img {
                width: 110px;
                height: 110px;
              }
            }
          </style>
        </head>
        <body>
          <div class="card">
            <img src="${reporter.image}" alt="Reporter Image" class="reporter-img" />
            <h2>Reporter Details</h2>
            <p><strong>IINSAF ID:</strong> ${reporter._id}</p>
            <p><strong>Channel Name:</strong> ${reporter.channelName}</p>
            <p><strong>Name:</strong> ${reporter.name}</p>
            <p><strong>Designation:</strong> ${reporter.designation}</p>
            <p><strong>Location:</strong> ${reporter.state}</p>
          </div>
        </body>
      </html>
    `);
  } catch (error) {
    console.error("Error fetching reporter:", error);
    res.status(500).send("<h2>Something went wrong</h2>");
  }
};

module.exports = qrProfile;
