const mongoose = require('mongoose');

const paymentHistorySchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    ad: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Adpost', // replace with your actual ad model
        required: false // it's created after payment
    },
    paymentId: {
        type: String,
        required: true
    },
    amount: Number,
    currency: String,
    method: String,
    status: String,
    gst: Number,
    totalCost: Number,
    date: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('PaymentHistory', paymentHistorySchema);
