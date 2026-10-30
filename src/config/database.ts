import mongoose from "mongoose";
import { config } from "./env.js";


/**
 * Établit la connexion à MongoDB.
 * Lève une erreur si la configuration est absente ou si la connexion échoue (empêche le serveur de démarrer sans DB).
 */
export async function connectDB(
    uri : string    
): Promise<void> {

    if (!uri ) {
        throw new Error(
            "❌ Configuration de base de données manquante : veuillez définir DB_NAME (ainsi que DB_HOST, DB_USERNAME, DB_PASSWORD) dans votre fichier d'environnement."
        );
    }
     try {
        mongoose.connection.on("connected", ()=>{
            console.log("successfully connexion to mongoDB")
        })
        await mongoose.connect(uri);     
        console.log("✅ Connexion à MongoDB réussie !");
    } catch (error) {
        console.error("❌ Connexion à MongoDB échouée :", error);
        throw error;
    }
}
