import { Mastra } from "@mastra/core";

import { moneyTransmitter } from "./agents/moneyTransmitter";

export const mastra = new Mastra({
    agents: { moneyTransmitter },
});
