require("dotenv").config()

const mongoose =require("mongoose");
const dbUrl = process.env.DATABASE_URL;

const connectDb =async()=>{
    await mongoose.connect(dbUrl);
}

module.exports={connectDb}