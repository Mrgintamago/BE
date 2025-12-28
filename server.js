const mongoose = require("mongoose");
const dotenv = require("dotenv");

process.on("uncaughtException", (err) => {
  console.log("UNCAUGHT EXCEPTION! Shutting down...");
  console.log(err.name, err.message);
  process.exit(1);
});

dotenv.config({ path: "./config.env" });
const app = require("./app");

// Fix Mongoose deprecation warning
mongoose.set("strictQuery", false);

const DB = process.env.MONGODB_URI || "mongodb://127.0.0.1:27017/tqn_figure_shop";

const mongooseOptions = {
  maxPoolSize: 50,
  minPoolSize: 10,
  maxConnecting: 10,
  socketTimeoutMS: 60000,
  serverSelectionTimeoutMS: 30000,
  connectTimeoutMS: 30000,
  maxIdleTimeMS: 30000,
  waitQueueTimeoutMS: 10000,
  retryWrites: true,
  w: 'majority',
  bufferCommands: false
};

mongoose.connect(DB, mongooseOptions)
  .then(() => {
    console.log('✅ Connected to MongoDB successfully!');
    console.log(`📍 Database: ${DB.split('/').pop()}`);
    
    // Start server AFTER MongoDB connection is ready
    const port = process.env.PORT || 3000;
    const server = app.listen(port, () => {
      console.log(`App running on port ${port}...`);
    });

    // Graceful shutdown handler
    const gracefulShutdown = (signal) => {
      console.log(`\n${signal} received. Shutting down gracefully...`);
      server.close(() => {
        console.log('HTTP server closed.');
        mongoose.connection.close(false, () => {
          console.log('MongoDB connection closed.');
          process.exit(0);
        });
      });
    };

    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
  })
  .catch(err => {
    console.error('❌ DB Connection Error:', err.message);
    console.error('🔍 MongoDB URI check:', DB.includes('@') ? 'Using Atlas' : 'Local');
    console.error('⚠️ Server will not start until MongoDB is connected');
    process.exit(1);
  });

// Monitor connection state with detailed logging
mongoose.connection.on('connected', () => {
  console.log('✅ Mongoose connected to MongoDB');
});
mongoose.connection.on('disconnected', () => {
  console.log('⚠️ Mongoose disconnected from MongoDB');
});
mongoose.connection.on('reconnected', () => {
  console.log('🔄 Mongoose reconnected to MongoDB');
});
mongoose.connection.on('error', (err) => {
  console.error('❌ Mongoose connection error:', err.message);
});
mongoose.connection.on('timeout', () => {
  console.error('⏱️ Mongoose connection timeout');
});

process.on("unhandledRejection", (err) => {
  console.log("UNHANDLED REJECTION! Shutting down...");
  console.log(err.name, err.message);
  server.close(() => {
    process.exit(1);
  });
});
