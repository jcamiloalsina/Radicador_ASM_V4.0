// MongoDB Initialization Script
// Creates application user with readWrite role on the application database
// This script runs when MongoDB container is first initialized

print("=".repeat(60));
print("🔐 INITIALIZING MONGODB AUTHENTICATION");
print("=".repeat(60));

// Get environment variables (these are set in docker-compose.yml)
const appUser = process.env.MONGO_APP_USER || "app_user";
const appPassword = process.env.MONGO_APP_PASSWORD || "changeme";
const dbName = process.env.MONGO_INITDB_DATABASE || "catastro_asomunicipios";

// Switch to the application database
db = db.getSiblingDB(dbName);

// Check if user already exists
const existingUser = db.getUsers().users.find(u => u.user === appUser);

if (existingUser) {
    print("ℹ️ User '" + appUser + "' already exists, skipping creation");
} else {
    // Create application user with readWrite role
    db.createUser({
        user: appUser,
        pwd: appPassword,
        roles: [
            {
                role: "readWrite",
                db: dbName
            }
        ]
    });
    print("✅ Created user '" + appUser + "' with readWrite role on '" + dbName + "'");
}

// Also create the user on admin database for authentication
db = db.getSiblingDB("admin");
const adminUser = db.getUsers().users.find(u => u.user === appUser);

if (!adminUser) {
    db.createUser({
        user: appUser,
        pwd: appPassword,
        roles: [
            {
                role: "readWrite",
                db: dbName
            }
        ]
    });
    print("✅ Created user '" + appUser + "' on admin database");
}

print("=".repeat(60));
print("✅ MONGODB INITIALIZATION COMPLETE");
print("=".repeat(60));
