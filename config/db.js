import mongoose from "mongoose";

const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGO_URI || "mongodb+srv://bainfo14:nZrzyDBQZWcAOY5Z@cluster0.jktzw.mongodb.net/blog");
        console.log(`MongoDB COnnected....${conn.connection.host}`);
    } catch (error) {
        console.log(`Error: ${error.message}`);
        process.exit(1);
    }
};

export default connectDB;