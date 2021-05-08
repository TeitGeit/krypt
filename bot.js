// dependencies
const { Client } = require("discord.js");
const dotenv = require("dotenv");
const axios = require('axios');
const { JsonDB } = require("node-json-db")
const { Config } = require("node-json-db/dist/lib/JsonDBConfig");
const { CronJob } = require("cron");

//konstanter
const cmdPrefix = ".";

// cron jobber
let dagenFor = new CronJob('00 55 07 * * *', backupDag);
dagenFor.start();

let databaseOppdater = new CronJob('0 */10 * * * *', oppdaterPris);
databaseOppdater.start();

// let storsteVinner = new CronJob('00 00 08 * * *', annonserStorsteVinner);
// storsteVinner.start();


// load environment variables
dotenv.config();

// Create bot instance
const bot = new Client();
var db = new JsonDB(new Config("myDataBase", true, false, '/'));

//emojier
// const arneL = bot.client.emojis.find(emoji => emoji.name === "arneL");
// console.log(db.getData("/priser/").ethereum);
// Log in bot
bot.login(process.env.DISCORD_BOT_TOKEN)

bot.on('ready', () => {
    console.log(`${bot.user.username} is up and running!`);
});
bot.on('message', async (message) => {
    // Do not reply if messages was sent by bot 
    if (message.author.bot) return;

    if (message.content.startsWith(cmdPrefix + "ping")) {
        return message.reply("I am working!");
    }
    if (message.content.startsWith(cmdPrefix + "pris")) {
        // Get the parameters 
        const [command, ...args] = message.content.split(" ");

        // check for number of arguments
        if (args.length === 1) {
            args.push("usd");
        }

        const [coin, vsCurrency] = args;

        if (args.length === 2) {
            try {
                var pris = db.getData(`/priser/${coin}`);
                var prisFor;
                try {
                    prisFor = db.getData(`/forrigeDogn/${coin}`) 
                } catch (error) {
                    prisFor = pris;
                }
                var forskjell = (pris/prisFor*100-100).toFixed(2);

                return message.reply(`Prisen på 1 ${coin} er nå ${pris} ${vsCurrency} og status: ${forskjell}%`);
            } catch (error) {
                try {
                    await leggTilKrypto(coin);
                    var pris = db.getData(`/priser/${coin}`);
                    return message.reply(`Prisen på 1 ${coin} er nå ${pris} ${vsCurrency}`);
                } catch (error) {
                    return message.reply("Ser ikke ut som valuta det der tjommi, sjekk igjen");
                }
            }
        }
    else {
        return message.reply(
            "Ett argument for dollar, TO for alle andre valuta you donkey"
        );
    }
}

    if (message.content.startsWith(cmdPrefix + "overvåk")) {
    const [command, ...args] = message.content.split(" ");
    [args].forEach(async (valuta) => {
        try {
            await leggTilKrypto(valuta);
            message.reply(`Lagt til og oppdatert ${valuta} i databasen`);
        } catch (error) {
            message.reply(`Fant ikke ${valuta} som en valuta, har du en liten skriveleif?`);
        }
    });
};

if (message.content.startsWith(cmdPrefix + "database")) {
    var melding = "Pris på kryptoen i databasen er:\n";
    var priser = Object.entries(await db.getData("/priser"));
    priser.forEach(([krypto, pris]) => {
        melding += `${krypto} : ${pris} USD\n`;
    });
    return message.reply(melding);
}

if (message.content.startsWith(cmdPrefix + "portefølje")) {
    const [command, ...args] = message.content.split(" ");
    var bruker = message.member.id;
    if (args[0] == "list") {
        try {
            var kryptoer = Object.entries(db.getData(`/portefolio/${bruker}`));
            var melding = "\nDu har registrert:\n";
            if (!kryptoer) throw Error();
            kryptoer.forEach((krypto) => {
                melding += `${krypto[0]} : ${krypto[1]}\n`
            });
            return message.reply(melding);
        } catch (err) {
            return message.reply("Registrer noe krypto før du lister opp med + eller -");
        }
    } else if (args[0] == "+" || args[0] == "-") {
        try {
            var krypto = args[1].toLowerCase();
            var antall = args[2];

            if (args.length !== 3 || await sjekkPris(krypto, "usd") === -1 || isNaN(antall)) throw Error();
            if (!(krypto in db.getData("/priser/"))) {
                leggTilKrypto(krypto);
            }
            antall = Number(antall);
            try {
                var antallFor = db.getData(`/portefolio/${bruker}/${krypto}/`);
                if (args[0] == "+") {
                    db.push(`/portefolio/${bruker}/${krypto}`, antall + antallFor);
                    return message.reply(`Du har nå ${antall + antallFor} ${krypto} i databasen`);
                } else {
                    db.push(`/portefolio/${bruker}/${krypto}`, antallFor - antall);
                    return message.reply(`Du har nå ${antallFor - antall} ${krypto} i databasen`);
                }
            } catch (error) {
                db.push(`/portefolio/${bruker}/${krypto}/`, antall);
                return message.reply(`Du har nå ${antall} ${krypto} i databasen`);
            }

        } catch (err) {
            return message.reply("Du har enten skrevet navnet til kryptoen feil eller ikke lagt til noen");
        }

    }
}

if (message.content.startsWith(cmdPrefix + "bal")) {
    const [command, ...args] = message.content.split(" ");
    var bruker;
    if (args.length === 0) {
        bruker = message.member.id;
    } else if (args.length === 1) {
        bruker = args[0].substring(3, args[0].length - 1);
    } else {
        return message.reply("Du må ha skrevet noe feil. .bal brukes enten uten en bruker eller ved å tagge en bruker etter kommandoen");
    }
    var melding = "Kryptoer og deres verdi i USD:\n";

    try {
        var kryptoer = Object.entries(db.getData(`/portefolio/${bruker}`));
    } catch (error) {
        return message.reply("Denne brukeren har ingen portefølje i databasen");
    }
    var total = 0;
    kryptoer.forEach(([krypto, antall]) => {
        var pris = db.getData(`/priser/${krypto}/`);
        var totalPris = Math.round(pris * antall);
        melding += `${antall} ${krypto} er verdt ${totalPris} USD\n`;
        total += totalPris;
    });

    melding += `Totalt samlet: ${total} USD`;
    return message.reply(melding);
}

if (message.content.startsWith(cmdPrefix + "gainz")) {
    const [command, ...args] = message.content.split(" ");
    
    var bruker;
    if (args.length > 0) {
        bruker = args[0].substring(3, args[0].length - 1);
    } else {
        bruker = message.member.id;


    }

    var totalGainz = gainz(bruker);
    return message.reply(`Siden i går er statusen for porteføljen: ${totalGainz}%`);

}

if (message.content.startsWith(cmdPrefix + "ranking")) {
    const [command, ...args] = message.content.split(" ");

    return message.reply(annonserStorsteVinner());
}

if (message.content.startsWith(cmdPrefix + "top")) {
    var melding = "Brukere med mest spænn i krypto:\n"
    var alleTop = [];

    Object.keys(db.getData("/portefolio/")).forEach((id) => {
        alleTop.push([id, totalBal(id)]);
    });
    alleTop.sort(function (first, second) {
        return second[1] - first[1];
    });
    alleTop.forEach(([id, top]) => {
        melding += `<@${id}> : ${top} USD\n`;
    })
    return message.reply(melding);
}

if (message.content.startsWith(cmdPrefix + "reload")) {
    await oppdaterPris();
    return message.reply("Prisene i databasen er nå oppdatert");
}




if (message.content.startsWith(cmdPrefix + "help")) {
    return message.reply(`\nHjelp for dumme folk:\n
${cmdPrefix}ping - sjekk om botten er oppe
${cmdPrefix}pris <valuta> [sammenligningsValuta] - Få den siste prisen på din shitcoin!
${cmdPrefix}overvåk <valuta> - Legg kryptovalutan på overvåkingslisten og inn i databasen.
${cmdPrefix}portefølje <+ eller - eller list> <valuta> <antall> - List tar og lister all kryptoen du har i øyeblikket eller så kan du legge til krypto med + eller -.
${cmdPrefix}database - lister opp alle valutaene og prisene på dem.
${cmdPrefix}bal [tag til bruker] - Viser alle valutaene i din portefølje og deres nåværende pris, kan også tagge en bruker og se på deres balanse.
        `);
}
    });
// console.log(checkPrice("ethereum","usd"));
async function sjekkPris(coin, vsCurrency) {
    try {
        const { data } = await axios.get(
            `https://api.coingecko.com/api/v3/simple/price?ids=${coin}&vs_currencies=${vsCurrency}`
        );
        // console.log(data);
        // console.log(`https://api.coingecko.com/api/v3/simple/price?ids=${coin}&vs_currencies=${vsCurrency}`);

        if (!data[coin][vsCurrency]) throw Error();

        // console.log(`Prisen på 1 ${coin} er nå ${data[coin][vsCurrency]} ${vsCurrency}`);

        return data[coin][vsCurrency];
    } catch (err) {
        return -1;
    };
}

async function leggTilKrypto(valuta) {
    var pris = await sjekkPris(valuta, "usd");
    if (pris === -1) {
        throw Error();
    } else {
        db.push(`/priser/${valuta}`, pris);
        return 1;
    }
}
async function oppdaterPris() {
    console.log("oppdaterer priser");
    var priser = Object.entries(await db.getData("/priser"));
    for (let [krypto, pris] of priser) {
        db.push(`/priser/${krypto}`, await sjekkPris(krypto, "usd"));
    }
}

async function backupDag() {
    await oppdaterPris();
    console.log("Siste time backet up!");

    db.push("/forrigeDogn/", db.getData("/priser/"));
}

function gainz(id) {
    try {
        var kryptoer = Object.entries(db.getData(`/portefolio/${id}`));
    } catch (error) {
        return "Denne brukeren har ingen portefølje i databasen";
    }
    var totalNaa = 0;
    var totalFor = 0;
    kryptoer.forEach(([krypto, antall]) => {
        var pris = db.getData(`/priser/${krypto}/`);
        try {
            var prisFor = db.getData(`/forrigeDogn/${krypto}/`);
        } catch (error) {
            var prisFor = pris;
        }
        var totalPrisFor = Math.round(prisFor * antall);
        var totalPris = Math.round(pris * antall);
        totalNaa += totalPris;
        totalFor += totalPrisFor;
    });

    return ((totalNaa / totalFor * 100) - 100).toFixed(2);
}

function totalBal(id) {
    var sum = 0;
    var portefolio = Object.entries(db.getData(`/portefolio/${id}/`));
    portefolio.forEach(([krypto, antall]) => {
        var pris = db.getData(`/priser/${krypto}`);
        sum += pris * antall;
    });
    return sum.toFixed(1);

}

function annonserStorsteVinner() {
    var melding = "Gainza til boysa sortert fra størst til minst iløpet av den siste timen:\n";
    var alleGainz = [];
    Object.keys(db.getData("/portefolio/")).forEach((id) => {
        alleGainz.push([id, gainz(id)]);
    });

    alleGainz.sort(function (first, second) {
        return second[1] - first[1];
    });
    alleGainz.forEach(([id, gain]) => {
        melding += `<@${id}> : ${gain}%\n`;
    })
    return melding;
}





