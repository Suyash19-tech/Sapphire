const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const User = require('./models/User');

dotenv.config();

const changePassword = async () => {
    const newPassword = process.argv[2];

    if (!newPassword) {
        console.error('Usage: npm run change-admin-pass -- YOUR_NEW_PASSWORD');
        process.exit(1);
    }

    try {
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('Connected to MongoDB...');

        const adminEmail = '23cd3047@rgipt.ac.in';
        const salt = await bcrypt.genSalt(10);
        const hashedPassword = await bcrypt.hash(newPassword, salt);

        const updatedUser = await User.findOneAndUpdate(
            { email: adminEmail },
            { password: hashedPassword },
            { returnDocument: 'after' }
        );

        if (updatedUser) {
            console.log(`Successfully updated password for ${adminEmail}`);
        } else {
            console.error(`User with email ${adminEmail} not found.`);
        }

        process.exit(0);
    } catch (error) {
        console.error('Error updating password:', error);
        process.exit(1);
    }
};

changePassword();
