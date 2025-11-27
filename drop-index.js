const mongoose = require('mongoose');

mongoose.connect('mongodb://localhost:27017/skillmetric')
  .then(async () => {
    console.log('Connected to MongoDB');
    const db = mongoose.connection.db;
    try {
      await db.collection('examsessions').dropIndex('sessionCode_1');
      console.log('Successfully dropped sessionCode_1 index');
    } catch (error) {
      console.log('Error dropping index:', error.message);
    }
    await mongoose.disconnect();
    console.log('Disconnected');
    process.exit(0);
  })
  .catch(err => {
    console.error('Connection error:', err);
    process.exit(1);
  });
