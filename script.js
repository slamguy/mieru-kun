const startBtn = document.getElementById("startBtn");
const startScreen = document.getElementById("startScreen");
const mainScreen = document.getElementById("mainScreen");
const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d", { willReadFrequently: true });
const info = document.getElementById("info");
const cameraBtn = document.getElementById("cameraBtn");
const imageInput = document.getElementById("imageInput");
const filterBtn = document.getElementById("filterBtn");
const typeBtn = document.getElementById("typeBtn");
const marker = document.getElementById("marker");
const colorPreview = document.getElementById("color-preview");
const torchBtn = document.getElementById("torchBtn");
const historyList = document.getElementById("historyList");

let mode = "none"; 
let filterActive = true;
let currentType = "normal"; // normal, protan, deutan, tritan
let torchOn = false;

// スタートボタン
startBtn.onclick = () => {
    startScreen.classList.remove("active");
    mainScreen.classList.add("active");
};

// カメラ起動
cameraBtn.onclick = async () => {
    mode = "camera";
    video.style.display = "block";
    canvas.style.display = "none";
    try {
        const stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "environment" },
            audio: false
        });
        video.srcObject = stream;
    } catch (err) {
        alert("カメラの起動に失敗しました。設定を確認してください。");
    }
};

// 画像アップロード
imageInput.onchange = (e) => {
    mode = "image";
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
        const img = new Image();
        img.onload = () => {
            canvas.width = img.width;
            canvas.height = img.height;
            ctx.drawImage(img, 0, 0);
            video.style.display = "none";
            canvas.style.display = "block";
        };
        img.src = event.target.result;
    };
    reader.readAsDataURL(file);
};

// 色補正の切り替え
filterBtn.onclick = () => {
    filterActive = !filterActive;
    filterBtn.innerText = filterActive ? "色補正 ON" : "色補正 OFF";
    applyFilter();
};

// タイプの切り替え
typeBtn.onclick = () => {
    const types = ["normal", "protan", "deutan", "tritan"];
    let idx = types.indexOf(currentType);
    currentType = types[(idx + 1) % types.length];
    typeBtn.innerText = `タイプ: ${currentType === "normal" ? "ノーマル" : currentType}`;
    applyFilter();
};

function applyFilter() {
    const filterValue = (!filterActive || currentType === "normal") 
        ? "none" 
        : `url(#${currentType}-filter)`;
    
    // 1. フィルターを適用する
    video.style.filter = filterValue;
    canvas.style.filter = filterValue;

    // 2. iPhone用の「再描画」のおまじない
    // 一瞬だけ非表示にしてすぐに戻すことで、画面を強制リフレッシュさせます
    if (mode === "camera") {
        video.style.opacity = "0.99";
        setTimeout(() => {
            video.style.opacity = "1";
        }, 1);
    }
}

// ライト機能（iPhone対応）
torchBtn.onclick = async () => {
    if (mode !== "camera") return;
    const stream = video.srcObject;
    if (!stream) return;
    const track = stream.getVideoTracks()[0];
    
    try {
        torchOn = !torchOn;
        await track.applyConstraints({
            advanced: [{ torch: torchOn }]
        });
        torchBtn.innerText = torchOn ? "🔦 ライト ON" : "🔦 ライト OFF";
    } catch (err) {
        alert("このカメラはライト制御に対応していません。");
    }
};

// クリックで色判定（読み上げ・履歴追加）
const actionTarget = [video, canvas];
actionTarget.forEach(el => {
    el.addEventListener("click", (e) => {
        let r, g, b;
        const rect = el.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        if (mode === "camera") {
            const tempCanvas = document.createElement("canvas");
            tempCanvas.width = video.videoWidth;
            tempCanvas.height = video.videoHeight;
            const tempCtx = tempCanvas.getContext("2d");
            tempCtx.drawImage(video, 0, 0);
            const scaleX = video.videoWidth / rect.width;
            const scaleY = video.videoHeight / rect.height;
            const pixel = tempCtx.getImageData(x * scaleX, y * scaleY, 1, 1).data;
            r = pixel[0]; g = pixel[1]; b = pixel[2];
        } else {
            const scaleX = canvas.width / rect.width;
            const scaleY = canvas.height / rect.height;
            const pixel = ctx.getImageData(x * scaleX, y * scaleY, 1, 1).data;
            r = pixel[0]; g = pixel[1]; b = pixel[2];
        }

        const colorName = getColorName(r, g, b);
        
        // 表示更新
        info.innerText = `色: ${colorName} / R:${r} G:${g} B:${b}`;
        colorPreview.style.display = "block";
        colorPreview.style.backgroundColor = `rgb(${r},${g},${b})`;
        
        // マーカー移動
        marker.style.display = "block";
        marker.style.left = `${x}px`;
        marker.style.top = `${y}px`;

        // 【新機能1】音声読み上げ（iPhoneマナーモード時は音が出ません）
        try {
            const uttr = new SpeechSynthesisUtterance(colorName);
            uttr.lang = "ja-JP";
            speechSynthesis.cancel();
            speechSynthesis.speak(uttr);
        } catch (e) {}

        // 【新機能2】履歴追加
        try {
            const li = document.createElement("li");
            li.style.cssText = "display: flex; align-items: center; gap: 10px; background: white; padding: 10px; border-radius: 10px; box-shadow: 0 1px 4px rgba(0,0,0,0.1);";
            li.innerHTML = `
                <div style="width: 20px; height: 20px; border-radius: 4px; background: rgb(${r},${g},${b}); border: 1px solid #ccc;"></div>
                <div style="font-size: 14px; font-weight: bold;">${colorName}</div>
            `;
            historyList.insertBefore(li, historyList.firstChild);
            if (historyList.children.length > 5) historyList.removeChild(historyList.lastChild);
        } catch (e) {}
    });
});

// 色名判定ロジック
function getColorName(r, g, b) {
    const colors = [
        { name: "赤", r: 255, g: 0, b: 0 },
        { name: "緑", r: 0, g: 255, b: 0 },
        { name: "青", r: 0, g: 0, b: 255 },
        { name: "黄", r: 255, g: 255, b: 0 },
        { name: "白", r: 255, g: 255, b: 255 },
        { name: "黒", r: 0, g: 0, b: 0 },
        { name: "オレンジ", r: 255, g: 165, b: 0 },
        { name: "紫", r: 128, g: 0, b: 128 },
        { name: "ピンク", r: 255, g: 192, b: 203 },
        { name: "茶色", r: 165, g: 42, b: 42 },
        { name: "グレー", r: 128, g: 128, b: 128 },
        { name: "水色", r: 173, g: 216, b: 230 }
    ];
    let minDist = Infinity;
    let closestColor = "不明";
    colors.forEach(c => {
        const dist = Math.sqrt((r - c.r)**2 + (g - c.g)**2 + (b - c.b)**2);
        if (dist < minDist) {
            minDist = dist;
            closestColor = c.name;
        }
    });
    return closestColor;
}