#!/usr/bin/env -S deno run --allow-env --allow-run --allow-net

import * as path from "https://deno.land/std@0.111.0/path/mod.ts";

class Output {
    constructor(private _buf: string) { }

    toString() { return this._buf; }
    json() { return JSON.parse(this.toString()); }

    filterLine(predicate:
        (value: string, index: number, array: string[]) => unknown) {
        return this.toString()
            .split("\n")
            .filter(predicate)
            .join("\n");
    }
}

async function processRun(...args: string[]) {
    return await (Deno.run({ cmd: [...args]}).status());
}

async function processOutput(...args: string[]) {
    const p = Deno.run({
        cmd: [...args],
        stdout: "piped",
    });
    const result = await p.status();
    if (result.code != 0) {
        throw new Error("process failed");
    }
    return new Output(new TextDecoder().decode(await p.output()));
}

function trimConsoleText(str: string) {
    return str.replace(/^\n*/g, "")
        .replace(/\n*$/g, "")
        .replace(/^\s*$/g, "");
}

class DfiCli {
    public path: string;
    public args: string[];
    private _onEachBlockFuncs: Array<(height: BlockHeight) => Promise<void>> = [];

    constructor(cliPath?: string, ...args: string[]) {
        if (cliPath) {
            this.path = cliPath;
        } else {
            const envPath = Deno.env.get("DEFI_CLI");
            this.path = envPath ? envPath : path.join(
                Deno.env.get("HOME")!,
                "/src/repos/ain/src/defi-cli"
            );
        }
        this.args = args;
    }

    run(...args: string[]) {
        const finalArgs = [...this.args, ...args];
        console.debug(finalArgs);
        return processRun(this.path, ...finalArgs);
    }

    output(...args: string[]) {
        const finalArgs = [...this.args, ...args];
        console.debug(finalArgs);
        return processOutput(this.path, ...finalArgs);
    }

    async outputString(...args: string[]) {
        return (await this.output(...args)).toString();
    }

    async waitForBlock(minHeight?: BlockHeight) {
        let min = minHeight ? minHeight.value : 0;
        let current = (await this.getBlockHeight()).value;
        if (!min) { min = current + 1 }

        while (current < min) {
            await new Promise((res, _) => setTimeout(() => res(0), 30 * 1000));
            current = (await this.getBlockHeight()).value;
            console.debug(`wait for block: ${min}, current: ${current}`);
        }
        return new BlockHeight(current);
    }

    addEachBlockEvent(func: (height: BlockHeight) => Promise<void>) {
        if (this._onEachBlockFuncs.indexOf(func) === -1)
            this._onEachBlockFuncs.push(func);
    }

    async runBlockEventLoop() {
        let onEachBlockFuncs = this._onEachBlockFuncs;
        let height = await this.getBlockHeight();
        while (onEachBlockFuncs.length > 0) {
            console.debug(`on each block event: ${height.value}`);
            for (const func of onEachBlockFuncs) {
                try {
                    await func(height);
                } catch (err) {
                    console.error(`err at ${new Date().toISOString()}`)
                    console.error(err);
                }
            }
            height = await this.waitForBlock(new BlockHeight(height.value + 1));
            onEachBlockFuncs = this._onEachBlockFuncs;
        }
    }

    async getNewAddress(): Promise<Address> {
        const res = await this.outputString("getnewaddress");
        return new Address(trimConsoleText(res));
    }

    async getBlockHeight(): Promise<BlockHeight> {
        const res = await this.outputString("getblockcount");
        const blocks = parseInt(trimConsoleText(res));
        if (!Number.isFinite(blocks))
            throw new Error("invalid numeric value returned");
        return new BlockHeight(blocks);
    }

    async appointOracle(address: Address, priceFeeds: OraclePriceFeed[], weightage: number):
        Promise<OracleId> {
        const res = await this.outputString("appointoracle",
            address.value,
            JSON.stringify(priceFeeds),
            weightage.toString());
        return new OracleId(trimConsoleText(res));
    }

    async listOracles(): Promise<OracleIdList> {
        const res = (await this.output("listoracles")).json() as string[];
        return res.map(x => new OracleId(trimConsoleText(x)));
    }

    async getOracleData(oracleId: OracleId) {
        const res = await (this.output("getoracledata", oracleId.value));
        return res.json();
    }

    async setOracleData(oracleId: OracleId,
        prices: OracleDataPrice[],
        timestamp = Math.floor(Date.now() / 1000),
        ): Promise<TxHash> {
        const jsonPrices = prices.map(x => {
            return {
                currency: x.currency,
                tokenAmount: x.tokenAmount.toString(),
            }
        });
        const res = await (this.outputString("setoracledata",
            oracleId.value,
            timestamp.toString(),
            JSON.stringify(jsonPrices)));
        return new TxHash(trimConsoleText(res));
    }

    async getBalance() {
        const res = await this.outputString("getbalance");
        const resNum = parseFloat(trimConsoleText(res));
        if (!Number.isFinite(resNum))
            throw new Error(`invalid balance number: ${res}`);
        return resNum;
    }

    async getTokenBalances() {
        const res = await this.output("gettokenbalances", "{}", "false", "true");
        const resJson: string[] = res.json();
        return resJson.map(x => new TokenAmount(x));
    }

    async setLoanToken(args: SetLoanTokenArgs) {
        const res = await this.outputString("setloantoken",
            JSON.stringify(flattenValues(args)));
        return new TxHash(trimConsoleText(res));
    }

    async poolSwap(args: PoolSwapArgs) {
        const res = await this.outputString("poolswap",
            JSON.stringify(flattenValues(args)));
        return new TxHash(trimConsoleText(res));
    }

    async testPoolSwap(args: PoolSwapArgs) {
        const res = await this.outputString("testpoolswap",
            JSON.stringify(flattenValues(args)));
        return new TokenAmount(trimConsoleText(res));
    }

    async createPoolPair(args: CreatePoolPairArgs) {
        const res = await this.outputString("createpoolpair",
            JSON.stringify(flattenValues(args)));
        return new TxHash(trimConsoleText(res));
    }

    async sendToAddress(address: Address, amount: number,
        comment = "", commentTo = "", subtractFeeFromAmount = false) {
        const res = await this.outputString("sendtoaddress", address.value,
            amount.toString(), comment, commentTo, subtractFeeFromAmount.toString());
        return new TxHash(trimConsoleText(res));
    }
}

type OraclePriceFeed = {
    currency: string,
    token: string,
};

type OracleDataPrice = {
    currency: string,
    tokenAmount: TokenAmount;
};

type OracleIdList = OracleId[];

class ValueType<T> {
    constructor(public value: T) {}
}

function flattenValues(args: any) {
    if (args instanceof ValueType)
        return args.value;

    const res: any = {};
    for (const propName in args) {
        const prop = args[propName];
        if (prop instanceof ValueType) {
            res[propName] = prop.value;
        } else {
            res[propName] = prop;
        }
    }
    return res;
}

class Address extends ValueType<string> {}
class BlockHeight extends ValueType<number> {}
class TxHash extends ValueType<string> {}
class OracleId extends ValueType<string> {}

class TokenAmount extends ValueType<string> {
    private _token;
    private _amount;

    constructor(amountWithToken: string) {
        super(amountWithToken);
        const res = amountWithToken.split("@");
        if (res.length != 2)
            this._throwInvalidFormatError();
        const [amount, token] = [parseFloat(res[0]), res[1]];
        if (token.length < 1 || token.length > 8)
            this._throwInvalidFormatError();
        if (!Number.isFinite(amount) && amount < 0)
            this._throwInvalidFormatError();
        this._token = token;
        this._amount = amount;
    }

    private _throwInvalidFormatError() {
        throw new Error("invalid token value format");
    }

    token() { return this._token; }
    amount() { return this._amount; }
    toString() { return this.amount() + "@" + this.token(); }
}

class PoolSwapArgs {
    public to: Address;
    public amountFrom: number;

    constructor(
        public from: Address,
        public tokenFrom: string,
        public tokenTo: string,
        amount: number,
        to?: Address) {
        if (!to) {
            to = this.from;
        }
        this.amountFrom = amount;
        this.to = to;
    }
}

class SetLoanTokenArgs {
    name: string;
    fixedIntervalPriceId: string;
    constructor(public symbol: string,
        public interest: number,
        name?: string,
        fixedIntervalPriceId?: string) {
        if (!name) {
            name = symbol;
        }
        if (!fixedIntervalPriceId) {
            fixedIntervalPriceId = this.symbol + "/USD";
        }

        this.name = name;
        this.fixedIntervalPriceId = fixedIntervalPriceId;
    }
}

class CreatePoolPairArgs {
    constructor(
        public tokenA: string,
        public tokenB: string,
        public commission: number,
        public ownerAddress: Address,
        public status: boolean = true,
    ) { }
}

async function main() {
    const cli = new DfiCli(undefined);

    console.log(`using defi-cli: ${cli.path}`);
    // console.log((await cli.output("help")).filterLine(x => x.indexOf("oracle") > -1));

    let height = await cli.getBlockHeight();
    console.log("height: " + height.value);

    const addresses: Address[] = [];
    addresses.push(
        await cli.getNewAddress(),
        await cli.getNewAddress(),
    );

    const fixedPriceOracleProvider = new FixedPriceOracleProvider();
    const fixedPriceOracles: OracleId[] = [];
    // fixedPriceOracles.push(
    //     new OracleId("2ee214191ba658683a069b4b5f5a5dd81ad9259d83f6fecbc81c35e6f9138091"),
    //     new OracleId("8af73c982af3029194a0aca77c29b30ca98abbb4b557248687385fa220aa5d56"),
    // )

    const finnHubProvider = new FinnHubbProvider(["GOOGL", "TSLA", "MSFT", "TWTR", "META"]);
    const finnHubbOracles: OracleId[] = [];
    // finnHubbOracles.push(
    //     new OracleId("01f5d7930451acf2ea92b83f17fe72239da080dee8cbb6de6553f4845cef8f03"),
    //     new OracleId("adfd27cbceef167df76c20672c57d45c0a656d3a1539280e8d4dba364f0a4363"),
    // );

    for (const address of addresses) {
        const oracleId = await cli.appointOracle(address,
            [...fixedPriceOracleProvider.symbols()].map(x => { return { currency: "USD", token: x } }), 150);
        console.log("oracleId: " + oracleId.value);
        fixedPriceOracles.push(oracleId);
    }

    for (const address of addresses) {
        const oracleId = await cli.appointOracle(address,
            finnHubProvider.symbols.map(x => { return { currency: "USD", token: x } }), 150);
        console.log("oracleId: " + oracleId.value);
        finnHubbOracles.push(oracleId);
    }

    await cli.waitForBlock();

    const tasks = [];
    tasks.push(...fixedPriceOracles.map(x => setupFixedOracleLoop(cli, x, fixedPriceOracleProvider)));
    tasks.push(...finnHubbOracles.map(x => setupFinnhubbOracleLoop(cli, x, finnHubProvider)));

    await Promise.all(tasks);
    await cli.runBlockEventLoop();
    console.log("done");
}


class FixedPriceOracleProvider {
    constructor(
        public map = new Map([["DFI", "3"], ["ETH", "4000"], ["BTC", "60000"]]),
    ) { }

    symbols() {
        return this.map.keys();
    }
}

async function setupFixedOracleLoop(cli: DfiCli, oracleId: OracleId, provider: FixedPriceOracleProvider) {
    console.log(`fixed: setup oracle loop: start: ${oracleId.value}`);

    // console.log(await cli.getOracleData(oracleId));
    const res = await setFixedOracleData(cli, oracleId, provider);
    console.log(`fixed: ${res.value}`);

    cli.addEachBlockEvent(async (height) => {
        console.log(`onblock event: height: ${height.value}, oracle: ${oracleId.value}`);
        // console.log(await cli.getOracleData(oracleId));

        if (height.value % 20 == 0) return;
        const res = await setFixedOracleData(cli, oracleId, provider);
        console.log(`fixed: ${res.value}`);
    });

    console.log(`fixed: setup oracle loop: done: ${oracleId.value}`);
}

async function setFixedOracleData(cli: DfiCli, oracleId: OracleId, provider: FixedPriceOracleProvider) {
    const symbols = provider.symbols();
    const oracleDataPrices: OracleDataPrice[] = [];

    for (const symbol of symbols) {
        oracleDataPrices.push({
            currency: "USD",
            tokenAmount: new TokenAmount(
                `${await provider.map.get(symbol)}@${symbol}`),
        });
    }

    oracleDataPrices.map(oracleDataPrice => {
        console.log(`price set: ${oracleDataPrice.tokenAmount.toString()}`);
    });
    const hash = await cli.setOracleData(oracleId, oracleDataPrices);
    return hash;
}

class FinnHubbProvider {
    constructor(
        public symbols: string[],
        public baseUrl = 'https://finnhub.io/api/v1/quote',
        private apiToken = Deno.env.get("FINNHUBB_TOKEN") || "c3mmjrqad3ieepc3s0u0"
    ) {}

    async fetchPrice(symbol: string) {
        const fetchPath = `${this.baseUrl}?symbol=${symbol}&token=${this.apiToken}`;
        const res = await fetch(fetchPath);
        const val = await res.json();
        return val.c;
    }
}

async function setupFinnhubbOracleLoop(cli: DfiCli, oracleId: OracleId, provider: FinnHubbProvider) {
    console.log(`finnhubb: setup oracle loop: start: ${oracleId.value}`);

    // console.log(await cli.getOracleData(oracleId));
    const res = await setFinnhubbOracleData(cli, oracleId, provider);
    console.log(`finnhubb: ${res.value}`);

    cli.addEachBlockEvent(async (height) => {
        console.log(`onblock event: height: ${height.value}, oracle: ${oracleId.value}`);
        // console.log(await cli.getOracleData(oracleId));

        if (height.value % 20 == 0) return;
        const res = await setFinnhubbOracleData(cli, oracleId, provider);
        console.log(`finnhubb: ${res.value}`);
    });

    console.log(`finnhubb: setup oracle loop: done: ${oracleId.value}`);
}

async function setFinnhubbOracleData(cli: DfiCli, oracleId: OracleId, provider: FinnHubbProvider) {
    const symbols = provider.symbols;
    const oracleDataPrices: OracleDataPrice[] = [];

    for (const symbol of symbols) {
        oracleDataPrices.push({
            currency: "USD",
            tokenAmount: new TokenAmount(
                `${await provider.fetchPrice(symbol)}@${symbol}`),
        });
    }

    oracleDataPrices.map(oracleDataPrice => {
        console.log(`price set: ${oracleDataPrice.tokenAmount.toString()}`);
    });
    const hash = await cli.setOracleData(oracleId, oracleDataPrices);
    return hash;
}

await main();
