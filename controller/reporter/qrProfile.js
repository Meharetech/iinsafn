const genrateIdCard = require("../../models/reporterIdGenrate/genrateIdCard");

const qrProfile = async (req, res) => {
  try {
    const cardId = req.params.id;
    const reporter = await genrateIdCard.findById(cardId);

    if (!reporter) {
      return res.status(404).send("<h2>Reporter not found</h2>");
    }

    // Check if reporter is verified (approved status)
    const isVerified = reporter.status === "Approved";
    const verificationBadge = isVerified ? 
      '<div class="verified-badge">✓ Verified Account</div>' : 
      '<div class="unverified-badge">⚠ Unverified</div>';

    res.send(`
      <html>
        <head>
          <title>Reporter Info - IINSAF</title>
          <meta name="viewport" content="width=device-width, initial-scale=1.0" />
          <style>
            * {
              margin: 0;
              padding: 0;
              box-sizing: border-box;
            }
            body {
              font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
              background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
              min-height: 100vh;
              display: flex;
              justify-content: center;
              align-items: center;
              padding: 10px;
            }
            .card {
              background: #ffffff;
              padding: 20px;
              border-radius: 20px;
              width: 100%;
              max-width: 380px;
              box-shadow: 0 20px 40px rgba(0, 0, 0, 0.1);
              text-align: center;
              position: relative;
              overflow: hidden;
            }
            .card::before {
              content: '';
              position: absolute;
              top: 0;
              left: 0;
              right: 0;
              height: 4px;
              background: linear-gradient(90deg, #ff6b6b, #4ecdc4, #45b7d1);
            }
            .reporter-img {
              width: 100px;
              height: 100px;
              object-fit: cover;
              border-radius: 50%;
              border: 3px solid #e0e0e0;
              margin: 0 auto 15px;
              display: block;
            }
            .verified-badge {
              background: linear-gradient(45deg, #4CAF50, #45a049);
              color: white;
              padding: 6px 12px;
              border-radius: 20px;
              font-size: 12px;
              font-weight: bold;
              display: inline-block;
              margin-bottom: 15px;
              box-shadow: 0 2px 8px rgba(76, 175, 80, 0.3);
            }
            .unverified-badge {
              background: linear-gradient(45deg, #ff9800, #f57c00);
              color: white;
              padding: 6px 12px;
              border-radius: 20px;
              font-size: 12px;
              font-weight: bold;
              display: inline-block;
              margin-bottom: 15px;
              box-shadow: 0 2px 8px rgba(255, 152, 0, 0.3);
            }
            h2 {
              color: #333;
              margin-bottom: 20px;
              font-size: 20px;
              font-weight: 600;
            }
            .details-container {
              background: #f8f9fa;
              border-radius: 12px;
              padding: 15px;
              margin-top: 10px;
            }
            .detail-item {
              display: flex;
              justify-content: space-between;
              align-items: center;
              padding: 8px 0;
              border-bottom: 1px solid #e9ecef;
              font-size: 14px;
            }
            .detail-item:last-child {
              border-bottom: none;
            }
            .detail-label {
              color: #666;
              font-weight: 500;
              flex: 1;
              text-align: left;
            }
            .detail-value {
              color: #333;
              font-weight: 600;
              flex: 1;
              text-align: right;
              word-break: break-all;
            }
            .iinsaf-id {
              background: linear-gradient(45deg, #667eea, #764ba2);
              color: white;
              padding: 8px 12px;
              border-radius: 8px;
              font-family: monospace;
              font-size: 12px;
              margin-top: 10px;
            }
            .footer {
              margin-top: 20px;
              padding-top: 15px;
              border-top: 1px solid #e9ecef;
              color: #666;
              font-size: 12px;
            }
            .logo {
              width: 60px;
              height: 60px;
              margin: 0 auto 15px;
              display: block;
            }

            @media (max-width: 480px) {
              .card {
                padding: 15px;
                margin: 5px;
              }
              .reporter-img {
                width: 80px;
                height: 80px;
              }
              h2 {
                font-size: 18px;
                margin-bottom: 15px;
              }
              .detail-item {
                font-size: 13px;
                padding: 6px 0;
              }
              .details-container {
                padding: 12px;
              }
            }
          </style>
        </head>
        <body>
          <div class="card">
            <img src="${reporter.image || '/images/placeholder.png'}" alt="Reporter Image" class="reporter-img" />
            ${verificationBadge}
            <h2>Verified Profiles</h2>
            
            <div class="details-container">
              <div class="detail-item">
                <span class="detail-label">IINSAF ID:</span>
                <span class="detail-value">${reporter.iinsafId || reporter._id}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">Name:</span>
                <span class="detail-value">${reporter.name}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">Channel:</span>
                <span class="detail-value">${reporter.channelName}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">Designation:</span>
                <span class="detail-value">${reporter.designation || 'Reporter'}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">Location:</span>
                <span class="detail-value">${reporter.state}, ${reporter.city}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">Phone:</span>
                <span class="detail-value">${reporter.mobileNo}</span>
              </div>
              <div class="detail-item">
                <span class="detail-label">Valid Until:</span>
                <span class="detail-value">${reporter.validUpto || 'N/A'}</span>
              </div>
            </div>

            <div class="footer">
              <img src="/images/iinsaf.png" alt="IINSAF Logo" class="logo" />
              <div>International Influencing News Social Media Advertisement Federation</div>
            </div>
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
