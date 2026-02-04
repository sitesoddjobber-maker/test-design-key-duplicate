// ==========================================================================
// AI-KAGI STORE 診断・注文フロー & カメラ制御 (完全版)
// ==========================================================================

// --- グローバル変数 ---
let currentStep = 1;
const totalSteps = 6;
let videoStream = null; // カメラストリーム保持用

// データ保持オブジェクト
let quoteData = {
    location: '',       // Step 1: 使用場所
    hasEngraving: '',   // Step 2: 刻印有無
    maker: '',          // Step 3: メーカー
    keyType: '',        // Step 4: 形状 (standard/dimple)
    price: 0,           // 価格 (3000 or 5000)
    photo: null,        // Step 5: 写真 (Fileオブジェクト)
    keyNumber: ''       // Step 5: 番号
};

// ==========================================================================
// 1. モーダル制御
// ==========================================================================

// ツールを開く
function openTool() {
    document.getElementById('tool-overlay').style.display = 'block';
    document.body.style.overflow = 'hidden'; // 背景スクロール固定
}

// ツールを閉じる
function closeTool() {
    // カメラが起動中なら停止する
    if (videoStream) {
        stopCamera();
    }

    if (confirm('入力を中断しますか？')) {
        document.getElementById('tool-overlay').style.display = 'none';
        document.body.style.overflow = 'auto';
        resetForm();
    }
}

// フォームリセット
function resetForm() {
    currentStep = 1;
    quoteData = { location: '', hasEngraving: '', maker: '', keyType: '', price: 0, photo: null, keyNumber: '' };

    // 入力欄クリア
    const numInput = document.getElementById('keyNumberInput');
    if (numInput) numInput.value = '';

    // 隠しファイル入力クリア
    const fileInput = document.getElementById('keyPhoto');
    if (fileInput) fileInput.value = '';

    // プレビューエリアを初期状態に戻す
    const previewBox = document.getElementById('preview-box');
    if (previewBox) {
        previewBox.innerHTML = '<span class="cam-icon">📷</span><br><span style="font-weight:bold; color:var(--primary);">ここをタップしてカメラ起動</span>';
    }

    // カメラエリアの表示リセット
    document.getElementById('camera-stream-area').style.display = 'none';
    document.getElementById('camera-preview-area').style.display = 'block';

    // ラジオボタンの選択解除
    document.querySelectorAll('input[type="radio"]').forEach(el => el.checked = false);

    updateView();
}

// ==========================================================================
// 2. ステップナビゲーション
// ==========================================================================

// 次のステップへ
function nextStep() {
    if (currentStep < totalSteps) {
        currentStep++;
        updateView();
    }
}

// 前のステップへ
function prevStep() {
    // カメラ起動中なら停止して戻る
    if (currentStep === 5 && videoStream) {
        stopCamera();
    }

    if (currentStep > 1) {
        currentStep--;
        updateView();
    }
}

// 表示更新処理 (プログレスバー同期)
function updateView() {
    // 全ステップ非表示
    document.querySelectorAll('.step').forEach(el => el.classList.remove('active'));
    // 現在のステップ表示
    document.querySelector(`.step[data-step="${currentStep}"]`).classList.add('active');

    // プログレスバー更新
    const percent = (currentStep / totalSteps) * 100;
    document.getElementById('progress-fill').style.width = `${percent}%`;
}

// ==========================================================================
// 3. ステップ別ロジック
// ==========================================================================

// Step 2: 刻印がない場合の処理
function checkEngraving() {
    alert("刻印がない鍵（合鍵から作った合鍵など）は、番号から作成することができません。\n\n申し訳ありませんが、元の純正キーをお探しいただくか、お近くの店舗へご相談ください。");
    closeTool();
}

// Step 3: メーカー選択
function setMaker(makerName) {
    quoteData.maker = makerName;
    setTimeout(() => { nextStep(); }, 200);
}

// Step 4: 鍵タイプ選択（ここで価格決定）
function setKeyType(type) {
    quoteData.keyType = type;

    // 価格ロジック (一律設定)
    if (type === 'standard') {
        quoteData.price = 3000;
    } else if (type === 'dimple') {
        quoteData.price = 5000;
    }

    setTimeout(() => { nextStep(); }, 200);
}

// ==========================================================================
// 4. カメラ制御 & 画像処理 (Step 5)
// ==========================================================================

// カメラを起動する
async function initCamera() {
    // 既存のデータがあれば確認
    if (quoteData.photo) {
        if (!confirm("現在の写真を削除して、カメラを起動しますか？")) return;
        quoteData.photo = null;
    }

    const video = document.getElementById('camera-video');
    const streamArea = document.getElementById('camera-stream-area');
    const previewArea = document.getElementById('camera-preview-area');

    try {
        // カメラ権限リクエスト (スマホの背面カメラを優先)
        const stream = await navigator.mediaDevices.getUserMedia({
            video: {
                facingMode: "environment",
                width: { ideal: 1280 },
                height: { ideal: 720 }
            },
            audio: false
        });

        videoStream = stream;
        video.srcObject = stream;

        // UI切り替え (プレビューを隠してビデオを表示)
        previewArea.style.display = 'none';
        streamArea.style.display = 'block';

    } catch (err) {
        console.error("Camera Error:", err);
        alert("カメラを起動できませんでした。\n権限が許可されていないか、対応していないブラウザです。\n\nファイル選択画面を開きます。");
        // フォールバック: ファイル選択を開く
        document.getElementById('keyPhoto').click();
    }
}

// カメラを停止する
function stopCamera() {
    if (videoStream) {
        videoStream.getTracks().forEach(track => track.stop());
        videoStream = null;
    }
    document.getElementById('camera-stream-area').style.display = 'none';
    document.getElementById('camera-preview-area').style.display = 'block';
}

// 写真を撮影する (映像をCanvasに描画して取得)
function takePhoto() {
    const video = document.getElementById('camera-video');

    // Canvasを作成 (現在のビデオサイズに合わせる)
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');

    // 現在の映像を描画
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    // 画像データ(Blob)に変換して保存
    canvas.toBlob(blob => {
        // ファイルオブジェクトとして保存 (ファイル名は現在時刻)
        const fileName = `key_photo_${Date.now()}.jpg`;
        const file = new File([blob], fileName, { type: "image/jpeg" });
        quoteData.photo = file;

        // プレビュー表示 (撮影した画像を表示)
        const previewBox = document.getElementById('preview-box');
        previewBox.innerHTML = `<img src="${URL.createObjectURL(blob)}" alt="撮影画像" style="width:100%; height:100%; object-fit:contain; border-radius:12px;">`;

        // カメラ停止して元の画面に戻る
        stopCamera();

    }, 'image/jpeg', 0.8); // 画質80%
}

// ファイル選択時の処理 (通常アップロード用フォールバック)
function handleFileSelect(input) {
    if (input.files && input.files[0]) {
        quoteData.photo = input.files[0];

        const reader = new FileReader();
        reader.onload = function (e) {
            const previewBox = document.getElementById('preview-box');
            previewBox.innerHTML = `<img src="${e.target.result}" alt="選択画像" style="width:100%; height:100%; object-fit:contain; border-radius:12px;">`;
        }
        reader.readAsDataURL(input.files[0]);
    }
}

// ==========================================================================
// 5. 最終確認 & カート処理
// ==========================================================================

// Step 5 -> 6: バリデーションと計算結果表示
function validateAndCalc() {
    // 1. 鍵番号のチェック
    const inputNum = document.getElementById('keyNumberInput').value;
    if (!inputNum || inputNum.trim() === "") {
        alert("鍵番号を入力してください。\n（刻印されている英数字です）");
        return;
    }
    quoteData.keyNumber = inputNum;

    // 2. 写真のチェック（必須要件）
    if (!quoteData.photo) {
        alert("鍵の写真が必要です。\n「タップしてカメラ起動」から撮影するか、ファイルを選択してください。");
        return;
    }

    // 画面への反映
    const locationMap = { 'entrance': '玄関', 'office': '会社・店舗', 'room': '室内・その他', 'other': 'その他' };
    const typeMap = { 'standard': 'ギザギザ（標準）', 'dimple': 'ディンプル（高セキュリティ）' };

    document.getElementById('resLocation').textContent = locationMap[quoteData.location] || 'その他';
    document.getElementById('resMaker').textContent = quoteData.maker;
    document.getElementById('resType').textContent = typeMap[quoteData.keyType];
    document.getElementById('resNumber').textContent = quoteData.keyNumber;

    // 金額表示
    document.getElementById('finalPriceDisplay').textContent = quoteData.price.toLocaleString() + "円";

    nextStep();
}

// Step 6: カートに追加
function addToCart() {
    const message = `【注文内容】\n用途: ${quoteData.location}\nメーカー: ${quoteData.maker}\nタイプ: ${quoteData.keyType}\n番号: ${quoteData.keyNumber}\n\n価格: ${quoteData.price}円\n\n(ShopifyのカートAPIへ送信します...)`;
    alert(message);

    // TODO: ここにShopifyのAjax API (FormData使用) を実装
    // 画像データを送る場合、ShopifyアプリのバックエンドAPI等が必要になる場合があります。
    // 標準機能だけで行う場合、Base64文字列にしてLine Item Propertiesに入れる手もありますが、容量制限に注意が必要です。
}