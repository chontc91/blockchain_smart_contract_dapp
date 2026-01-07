import "./App.css";
import React, { useEffect, useMemo, useState } from "react";
import Web3 from "web3";
import { simpleStorageAbi } from "./abis";

// QUAN TRỌNG: cập nhật đúng địa chỉ contract vừa deploy trên Ganache hiện tại
const contractAddr = "0x97FE3FBccFe27A36f127507B68Fcb273984a8C50";

const GANACHE_CHAIN_IDS = new Set(["0x539", "0x1691"]); // 1337, 5777

function shortAddr(a = "") {
  return a ? `${a.slice(0, 6)}...${a.slice(-4)}` : "";
}

function App() {
  const [number, setNumber] = useState("13");
  const [getNumber, setGetNumber] = useState("0");
  const [status, setStatus] = useState("—");

  const [account, setAccount] = useState("");
  const [chainId, setChainId] = useState("");
  const [isReady, setIsReady] = useState(false);

  const { web3, contract } = useMemo(() => {
    if (!window.ethereum) return { web3: null, contract: null };
    const w3 = new Web3(window.ethereum);
    const c = new w3.eth.Contract(simpleStorageAbi, contractAddr);
    return { web3: w3, contract: c };
  }, []);

  const ensureConnected = async () => {
    if (!window.ethereum) throw new Error("Chưa cài MetaMask");

    const accounts = await window.ethereum.request({
      method: "eth_requestAccounts",
    });
    const cid = await window.ethereum.request({ method: "eth_chainId" });
    console.log("accounts=",accounts);
    setAccount(accounts?.[0] || "");
    setChainId(cid || "");

    if (!GANACHE_CHAIN_IDS.has(cid)) {
      throw new Error(
        `Sai mạng. Hãy chuyển MetaMask sang Ganache Local (chainId 1337/5777). Hiện tại: ${cid}`
      );
    }

    return { account: accounts[0], chainId: cid };
  };

  const validateContractOnChain = async () => {
    if (!web3) throw new Error("Web3 chưa sẵn sàng");
    const code = await web3.eth.getCode(contractAddr);

    // Nếu sai địa chỉ/đã restart ganache => code sẽ là "0x"
    if (!code || code === "0x") {
      throw new Error(
        `Không tìm thấy contract tại địa chỉ ${contractAddr}. ` +
          `Bạn đã redeploy hoặc restart Ganache? Hãy copy lại contract address từ Remix.`
      );
    }
  };

  const handleGet = async () => {
    try {
      if (!contract) throw new Error("Contract chưa sẵn sàng");

      setStatus("Đang đọc get()...");
      await ensureConnected();
      await validateContractOnChain();

      const result = await contract.methods.get().call();
      setGetNumber(String(result));
      setStatus("Đọc thành công");
    } catch (err) {
      console.error("GET ERROR FULL:", err);
      setStatus(`Lỗi get(): ${err?.data?.message || err?.message || "Unknown"}`);
    }
  };

  const handleSet = async (e) => {
    e.preventDefault();
    try {
      if (!contract || !web3) throw new Error("Web3/Contract chưa sẵn sàng");
      if (number === "" || number === null || number === undefined) {
        throw new Error("Vui lòng nhập số trước khi Set");
      }

      setStatus("Đang kiểm tra ví/chain/contract...");
      const { account } = await ensureConnected();
      await validateContractOnChain();

      setStatus("Đang ước lượng gas...");
      const gas = await contract.methods.set(number).estimateGas({ from: account });

      setStatus("Đang lấy gasPrice (legacy)...");
      const gasPrice = await web3.eth.getGasPrice();

      setStatus("Đang gửi transaction (MetaMask sẽ hiện popup)...");
      const receipt = await contract.methods.set(number).send({
        from: account,
        gas,
        gasPrice,
        type: "0x0", // ép legacy để tránh EIP-1559 trên Ganache
      });

      setStatus(`Ghi thành công. Tx: ${receipt.transactionHash}. Đang đọc lại...`);

      // Đọc lại sau khi ghi để UI luôn ra đúng (vd: 13)
      const latest = await contract.methods.get().call();
      setGetNumber(String(latest));
      setStatus(`Hoàn tất. Giá trị hiện tại: ${latest}`);
    } catch (err) {
      console.error("SET ERROR FULL:", err);

      // Hiển thị message “thật” hơn thay vì generic JSON-RPC
      const msg =
        err?.data?.message ||
        err?.cause?.message ||
        err?.message ||
        "Unknown error";

      setStatus(`Lỗi set(): ${msg}`);
    }
  };

  // Auto-init: lấy account/chainId, kiểm tra contract, và đọc giá trị hiện tại
  useEffect(() => {
    (async () => {
      try {
        if (!window.ethereum || !web3 || !contract) return;

        setStatus("Đang khởi tạo kết nối...");
        await ensureConnected();
        await validateContractOnChain();
        setIsReady(true);

        const current = await contract.methods.get().call();
        setGetNumber(String(current));
        setStatus("Sẵn sàng");
      } catch (err) {
        console.error("INIT ERROR FULL:", err);
        setIsReady(false);
        setStatus(err?.message || "Chưa sẵn sàng");
      }
    })();

    if (!window.ethereum) return;

    const onAccountsChanged = (accs) => {
      setAccount(accs?.[0] || "");
    };
    const onChainChanged = (cid) => {
      setChainId(cid || "");
      // Reload nhẹ để tránh provider cache sai network
      window.location.reload();
    };

    window.ethereum.on("accountsChanged", onAccountsChanged);
    window.ethereum.on("chainChanged", onChainChanged);

    return () => {
      window.ethereum.removeListener("accountsChanged", onAccountsChanged);
      window.ethereum.removeListener("chainChanged", onChainChanged);
    };
  }, [web3, contract]);

  return (
    <div className="App">
      <main className="container">
        <section className="card">
          <h1 className="title">SimpleStorage DApp</h1>
          <p className="subtitle">Ganache + MetaMask + Web3.js</p>
          <p className="subtitle">Họ và tên: Trương Chí Chọn - MSHV: 24C12025</p>

          <div className="statusWrap" style={{ marginTop: 12 }}>
            <div className="statusLabel">Kết nối</div>
            <div className="statusText">
              Account: {account ? shortAddr(account) : "—"} | ChainId:{" "}
              {chainId || "—"} | Contract: {shortAddr(contractAddr)} | Ready:{" "}
              {isReady ? "Yes" : "No"}
            </div>
          </div>

          <div className="grid">
            <form className="row" onSubmit={handleSet}>
              <label className="label" htmlFor="setNumber">
                Set number
              </label>

              <div className="inputGroup">
                <input
                  id="setNumber"
                  className="input"
                  type="number"
                  value={number}
                  onChange={(e) => setNumber(e.target.value)}
                  placeholder="Ví dụ: 13"
                />
                <button className="btn btnPrimary" type="submit" disabled={!isReady}>
                  Set
                </button>
              </div>
            </form>

            <div className="row">
              <label className="label">Get number</label>

              <div className="inputGroup">
                <div className="valueBox" aria-label="Current value">
                  {getNumber}
                </div>
                <button
                  className="btn btnSecondary"
                  onClick={handleGet}
                  type="button"
                  disabled={!isReady}
                >
                  Get
                </button>
              </div>
            </div>
          </div>

          <div className="statusWrap">
            <div className="statusLabel">Trạng thái</div>
            <div className="statusText">{status}</div>
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;
