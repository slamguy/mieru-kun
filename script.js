const video = document.getElementById("video");
const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");

const cameraBtn = document.getElementById("cameraBtn");
const imageInput = document.getElementById("imageInput");

const info = document.getElementById("info");

let filterOn = true;
let filterType = "normal"; // normal / protan / deutan / tritan
let mode = "camera";      // camera / image
let loadedImage = null;

let lastTap = null;
let frameColors = [];
const FRAME_BUFFER_SIZE = 8;

/* ===============================
   画像読み込み
=============================== */
imageInput.addEventListener("change", (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const img = new Image();
    img.onload = () => {
        canvas.width = img.width;
        canvas.height = img.height;
        loadedImage = img;
        mode = "image";
        update();
    };
    img.src = URL.createObjectURL(file);
});

/* ===============================
   色名取得
*/
function getColorName(r, g, b) {
    r /= 255; g /= 255; b /= 255;
    const max = Math.max(r, g, b);
    const min = Math.min(r, g, b);
    let h, s, l = (max + min) / 2;

    if (max === min) {
        h = 0;
        s = 0;
    } else {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h *= 60;
    }

    // ===== 無彩色 =====
    if (l < 0.12) return "黒";
    if (l > 0.88) return "白";
    if (s < 0.12) return "灰色";

    let baseColor = "";

    // ===== 色相判定（細分化）=====
    if (h < 10 || h >= 350) baseColor = "赤";
    else if (h < 25) baseColor = "朱色";
    else if (h < 45) baseColor = "橙";
    else if (h < 60) baseColor = "黄";
    else if (h < 85) baseColor = "黄緑";
    else if (h < 150) baseColor = "緑";
    else if (h < 190) baseColor = "青緑";
    else if (h < 210) baseColor = "水色";
    else if (h < 250) baseColor = "青";
    else if (h < 270) baseColor = "紺";
    else if (h < 300) baseColor = "青紫";
    else if (h < 330) baseColor = "紫";
    else baseColor = "ピンク";

    // ===== 明度・彩度で修飾 =====
    if (l > 0.75) return `明るい${baseColor}`;
    if (l < 0.25) return `暗い${baseColor}`;
    if (s < 0.3) return `くすんだ${baseColor}`;

    return baseColor;
}

/* ===============================
   色覚補正
=============================== */
/* 改良版：行列演算による補正ロジック */
function colorBlindFilter(r, g, b) {
    if (!filterOn || filterType === "normal") return [r, g, b];

    let nr, ng, nb;

    if (filterType === "protan") {
        // 1型（赤色弱）向け：赤の情報を緑と青にシフト
        nr = r * 0.56667 + g * 0.43333;
        ng = r * 0.55833 + g * 0.44167;
        nb = r * 0.0 + g * 0.24167 + b * 0.75833;
    } else if (filterType === "deutan") {
        // 2型（緑色弱）向け：緑の情報を赤と青にシフト
        nr = r * 0.625 + g * 0.375;
        ng = r * 0.7 + g * 0.3;
        nb = r * 0.0 + g * 0.3 + b * 0.7;
    } else if (filterType === "tritan") {
        // 3型（青色弱）向け
        nr = r * 0.95 + g * 0.05;
        ng = r * 0.0 + g * 0.43333 + b * 0.56667;
        nb = r * 0.0 + g * 0.475 + b * 0.525;
    }

    // 誤差（本来の色とシミュレーションの差）を計算し、見えるチャンネルに配分
    const errR = r - nr;
    const errG = g - ng;
    const errB = b - nb;

    // 補正値の加算（Daltonizationの核となるステップ）
    const finalR = r + (0.0 * errR) + (0.0 * errG) + (0.0 * errB);
    const finalG = g + (0.7 * errR) + (1.0 * errG) + (0.0 * errB);
    const finalB = b + (0.7 * errR) + (0.0 * errG) + (1.0 * errB);

    return [
        Math.min(255, Math.max(0, finalR)),
        Math.min(255, Math.max(0, finalG)),
        Math.min(255, Math.max(0, finalB))
    ];
}

/* ===============================
   カメラ起動
=============================== */
async function startCamera() {
    const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "environment" }
    });
    video.srcObject = stream;

    video.onloadeddata = () => {
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        mode = "camera";
        update();
    };
}

/* ===============================
   描画ループ（改良版：CSSフィルタ方式）
=============================== */
function update() {
    // 1. カメラ映像または画像をキャンバスに描画する
    if (mode === "camera" && video.readyState >= 2) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    } else if (mode === "image" && loadedImage) {
        ctx.drawImage(loadedImage, 0, 0, canvas.width, canvas.height);
    } else {
        // まだ映像が準備できていない場合は次へ
        requestAnimationFrame(update);
        return;
    }

    // 2. フィルタの適用（CSSを使って一括で色を変える）
    if (filterOn && filterType !== "normal") {
        // HTMLのSVGで定義したIDを指定する
        canvas.style.filter = `url(#${filterType}-filter)`;
    } else {
        // フィルタOFFまたはノーマルの場合は解除
        canvas.style.filter = "none";
    }

    // ループを継続
    requestAnimationFrame(update);
}

/* ===============================
   タップで色取得（マーカー・プレビュー対応版）
=============================== */
canvas.addEventListener("click", (e) => {
    const rect = canvas.getBoundingClientRect();
    // 1. タップされた座標を計算（Canvas内の位置）
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);

    // 2. ピクセルデータを取得
    const imgData = ctx.getImageData(x, y, 1, 1).data;
    const r = imgData[0];
    const g = imgData[1];
    const b = imgData[2];
    
    // 3. 色名を取得
    const colorName = getColorName(r, g, b);

    // 4. テキスト表示の更新
    info.innerText = `色: ${colorName} / R:${r} G:${g} B:${b}`;

    // 5. 【追加】プレビューボックスに色を付ける
    const preview = document.getElementById("color-preview");
    if (preview) {
        preview.style.display = "block";
        preview.style.backgroundColor = `rgb(${r}, ${g}, ${b})`;
    }

    // 6. 【追加】マーカーをタップした位置に動かす
    const marker = document.getElementById("marker");
    if (marker) {
        marker.style.display = "block";
        // 表示上の座標（クリックした瞬間のマウス位置）に合わせる
        marker.style.left = (e.clientX - rect.left) + "px";
        marker.style.top = (e.clientY - rect.top) + "px";
    }
});

/* ===============================
   UIボタン
=============================== */

document.getElementById("filterBtn").onclick = () => {
    filterOn = !filterOn;
};

document.getElementById("typeBtn").onclick = () => {
    const order = ["normal", "protan", "deutan", "tritan"];
    filterType = order[(order.indexOf(filterType) + 1) % order.length];

    document.getElementById("typeBtn").innerText = `タイプ: ${
        { normal:"ノーマル", protan:"1型色覚", deutan:"2型色覚", tritan:"3型色覚" }[filterType]
    }`;
};

// ===== スタート画面切り替え =====
const startBtn = document.getElementById("startBtn");
const startScreen = document.getElementById("startScreen");
const mainScreen = document.getElementById("mainScreen");

startBtn.onclick = () => {
  // 画面切り替え
  startScreen.classList.remove("active");
  mainScreen.classList.add("active");
};

cameraBtn.onclick = () => {
  startCamera();
};