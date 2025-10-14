const mongoose = require('mongoose');
const PaidConference = require('./models/pressConference/paidConference');

async function debugConferences() {
  try {
    await mongoose.connect('mongodb://localhost:27017/iinsaf', { 
      useNewUrlParser: true, 
      useUnifiedTopology: true 
    });
    
    console.log('Connected to MongoDB');
    
    // Check total conferences
    const total = await PaidConference.countDocuments();
    console.log('Total conferences:', total);
    
    // Check conferences by status
    const statusCounts = await PaidConference.aggregate([
      { $group: { _id: '$status', count: { $sum: 1 } } }
    ]);
    console.log('Conferences by status:', statusCounts);
    
    // Check conferences with approved proofs
    const withApprovedProofs = await PaidConference.find({
      'acceptedReporters.proof.status': 'approved'
    }).countDocuments();
    console.log('Conferences with approved proofs:', withApprovedProofs);
    
    // Check our new query
    const newQueryResults = await PaidConference.find({
      $or: [
        { status: 'completed' },
        { 
          status: 'running',
          'acceptedReporters.proof.status': 'approved'
        }
      ]
    }).countDocuments();
    console.log('New query results:', newQueryResults);
    
    // Get sample conferences
    const sampleConferences = await PaidConference.find({})
      .limit(3)
      .select('conferenceId status acceptedReporters.proof.status');
    console.log('Sample conferences:', JSON.stringify(sampleConferences, null, 2));
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error);
    process.exit(1);
  }
}

debugConferences();
