import { PluginBase } from "@goat-sdk/core";
import { CoinGeckoAPI } from "./api";
import { CoinGeckoService } from "./coingecko.service";
import { CoinGeckoProService } from "./pro.service";

interface CoingeckoPluginOptions {
    apiKey: string;
    isPro?: boolean;
}

export class CoinGeckoPlugin extends PluginBase {
    constructor({ apiKey, isPro = false }: CoingeckoPluginOptions) {
        const api = new CoinGeckoAPI(apiKey, isPro);
        const commonService = new CoinGeckoService(api);

        const services = [commonService];

        if (isPro) {
            services.push(new CoinGeckoProService(api));
        }

        super("coingecko", services);
    }

    supportsChain = () => true;
}

export function coingecko(options: CoingeckoPluginOptions) {
    return new CoinGeckoPlugin(options);
}
