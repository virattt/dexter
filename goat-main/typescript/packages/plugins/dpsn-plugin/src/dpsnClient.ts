import { config } from "dotenv";
import DpsnClient from "dpsn-client";
config({ path: ".env" });

export class Dpsnservice {
    private dpsnUrl: string;
    private pvtKey: string;
    private dpsnClient!: InstanceType<typeof DpsnClient>;
    private isDpsnClientInitialized!: boolean;
    constructor(dpsnUrl: string, pvtKey: string) {
        this.dpsnUrl = dpsnUrl ?? process.env.DPSN_URL;
        this.pvtKey = pvtKey ?? process.env.DPSN_PRIVATE_KEY;
        this.initialize();
    }

    async initialize() {
        try {
            this.dpsnClient = new DpsnClient(this.dpsnUrl, this.pvtKey, {
                network: "testnet",
                wallet_chain_type: "ethereum",
            });

            this.setupEventHandlers();

            await this.dpsnClient.init();
            this.isDpsnClientInitialized = true;
            console.log("[DPSN] Client initialized successfully");
        } catch (err) {
            console.error("[DPSN ERROR] error while client initializing", err);
        }
    }

    private setupEventHandlers() {
        this.dpsnClient.on("connect", () => {
            console.log("[DPSN] Connected successfully");
        });
        this.dpsnClient.on("error", (error: Error) => {
            console.error("[DPSN] Error:", error);
        });
        this.dpsnClient.on("disconnect", () => {
            console.log("[DPSN] Disconnected");
            this.isDpsnClientInitialized = false;
        });
    }

    async subscribe(topic: string, callback: (message: unknown) => void) {
        try {
            if (!this.isDpsnClientInitialized) {
                console.log("initializing dpsn client before publishing");
                this.initialize();
            }
            await this.dpsnClient.subscribe(topic, (topic, message, nwPacket) => {
                callback(message);
            });
        } catch (err) {
            console.error("[DPSN ERROR] Error while subscribing:", err);
            return false;
        }
    }

    async unsubscribe(topic: string): Promise<boolean> {
        try {
            if (!this.isDpsnClientInitialized) {
                console.log("client is not intitialized cannot unsubscribe");
                return false;
            }
            await this.dpsnClient.unsubscribe(topic);
            return true;
        } catch (err) {
            console.error("[DPSN ERROR] Error while unsubscribing:", err);
            return false;
        }
    }

    async disconnect() {
        try {
            if (!this.isDpsnClientInitialized) {
                console.log("Cannot disconnect since client is uninitialized");
            }
            await this.dpsnClient.disconnect();
            return true;
        } catch (err) {
            console.error("[DPSN ERROR] Error while disconnecting dpsn client:", err);
            return false;
        }
    }
}
