# **Firebase AI Logic でリアルタイムのローカル映画検索を構築する**

* **前提条件:** [Build with Firebase Data Connect (web)](https://firebase.google.com/codelabs/firebase-dataconnect-web) コードラボの完了。  
* **トピック:** Gemini 3 Flash と Google 検索のグラウンディング（Grounding）を使用した「AI Logic」の実装。

## **1\. 概要**

前回のコードラボでは、Firebase Data Connect と Cloud SQL を使用して堅牢な映画レビュー アプリケーションを構築しました。`Movies`（映画）、`Reviews`（レビュー）、`Users`（ユーザー）のスキーマを定義し、それらをフィルタリングする UI を作成しました。

標準的なデータベース クエリは、「2024年に公開された映画を探す」といった構造化されたデータに対しては非常に優れています。しかし、以下の 2 種類のユーザー ニーズには対応しきれないことがあります。

1. **曖昧または概念的な意図:** 「温かいハグのような（ほっこりする）映画が見たい。」  
2. **リアルタイムの世界知識:** 「今、ダウンタウンの映画館で上映されている、これに似た映画は何？」

このモジュールでは、**Firebase AI Logic** を実装して、このギャップを埋めていきます。

### **アーキテクチャ**

アプリの大部分はそのまま残します。これらのユーザー ニーズを満たす新機能を実装するために、基本的なコンポーネントやデータベース スキーマを変更する必要はありません。

その代わりに、構築済みのものの上に「AI エージェント」機能を追加します。これによりアプリをさらに強化し、映画データベースにある作品と似た映画で、かつ近所や任意の場所でリアルタイムに上映されているものを検索できるようにします。

ここでの **AI エージェントの使用パターン** は以下の通りです。

1. **Gemini 3 を使用して、現在リアルタイムで上映中の類似映画を検索する:** Firebase AI Logic と Gemini 3 を使用し、ユーザーが現在表示している映画のメタデータと希望する場所を提供することで、マルチモーダル検索を行います。  
2. **要件を満たすために AI エージェントが使用すべきツールを指定する:** （例: Google 検索の使用など）。  
3. **Gemini からアプリに返してほしいレスポンス データの形式を指定する:** アプリ内で表示しやすい形式を指定します。  
4. **レスポンス データを処理する:** Web アプリケーションのページに表示します。

### **構築するもの**

* **AI Logic サービス:** Google 検索ツールを使用して Gemini にクエリを送信するクライアントサイド サービス。  
* **構造化プロンプティング (Structured Prompting):** コード内で利用可能な JSON データを AI に強制的に返させるテクニック。

## **2\. Cloud コンソールで Firebase AI Logic API と Vertex AI API を有効にする**

1. Qwiklabs で生成されたプロジェクトを使用して、Cloud コンソールの認証情報ページにアクセスします: [https://console.cloud.google.com/apis/credentials](https://console.cloud.google.com/apis/credentials)  
2. **Browser Key**（Firebase によって自動生成されたもの）に移動 \> 下にスクロールして \[API の制限\] セクションへ移動します。  
3. \[API キー\] をクリックし、**Firebase AI Logic API** と **Vertex AI API** の両方が選択されていることを確認します。  
4. \[保存\] をクリックします。

## **3\. Firebase AI Logic のセットアップ**

クライアント アプリケーションから Gemini モデルに直接アクセスするために、Firebase AI Logic SDK を使用します。

### **1\. Firebase AI Logic SDK を有効にする**

1. `firebase.tsx (app/src/lib/firebase.tsx)` の上部にある import 文の**コメントアウトを解除**します。

```javascript
import { getAI, getGenerativeModel, GoogleAIBackend } from "firebase/ai";
```

## **4\. 検索対応モデル (Search-Enabled Model) の構成**

このステップでは、AI モデルの具体的な構成を定義します。ここでは単に標準的なテキスト モデルをインスタンス化するだけではありません。**グラウンディング (Grounding)** を使用して、モデルに外の世界へのアクセス権を与えます。

**目標:** Google 検索を実行してリアルタイムの情報を取得できる Gemini モデルを返す関数を作成します。これは、検索ツールを使用してアプリに応答を返すエージェントとして機能します。

### **1\. サービスの初期化**

`firebase.tsx (app/src/lib/firebase.tsx)` で、以下のコード行のコメントアウトを解除します。

```javascript
const ai = getAI(firebaseApp);
```

これにより、`getAI` を使用して Firebase AI Logic サービスが初期化されます。現在の `firebaseApp` 構成（API キーとプロジェクト ID を保持）が AI SDK に渡され、アプリと Google サーバー間のブリッジが作成されます。

### **2\. モデル構成の定義**

`firebase.tsx (app/src/lib/firebase.tsx)` で、以下のコード行のコメントアウトを解除します。

```javascript
const ai = getAI(firebaseApp);

export const getSearchEnabledModel = () => {
 return getGenerativeModel(ai, {
   model: "gemini-3-flash-preview",
   tools: [{ googleSearch: {} }]
 });
};
```

`getSearchEnabledModel` 内部で `getGenerativeModel` を呼び出しています。ここが重要なポイントです。以下の 2 つの構成要素を渡しています。

**モデル (`model`):** ここでは `"gemini-3-flash-preview"` を選択しています。これは使用したい大規模言語モデル（LLM）の特定のバージョンです。「Flash」モデルは速度と低レイテンシに最適化されており、ユーザー向けアプリケーションに最適です。

**ツール (`tools`):**

```javascript
tools: [{ googleSearch: {} }]
```

これが重要な追加部分です。`tools` 配列に `googleSearch` ツールを渡すことで、**グラウンディング (Grounding)** を有効にしています。

* **これがない場合:** モデルはトレーニング データ（カットオフ日がある）のみに依存します。  
* **これがある場合:** モデルは、ユーザーが現在のイベントや特定の事実について質問したこと（例: 「現在の Alpha の株価は？」）を認識し、回答を生成する前に自動的に Google 検索を使用して答えを見つけることができます。

**重要なポイント:**

* **`googleSearch: {}`**: この 1 行だけで、LLM に Google 検索からのライブ情報へのアクセス権を与え、本来なら知り得ない現在の上映時間に関する質問に答えられるようにします。

## **5\. 映画館検索のプロンプトとインターフェースの構築**

検索対応モデルの構成が完了したので、これと対話するためのフロントエンドが必要です。このステップでは、この目的のために事前に作成された `FindTheatresPage` コンポーネントを使用します。

**目標:** ユーザーの現在地と日付を取得する React インターフェースを使用し、構造化されたプロンプトを Gemini に送信して、Google 検索経由で見つかった上映時間をレンダリングします。

`App.tsx (app/src/App.tsx)` で、以下の 2 行のコメントアウトを解除して `FindTheatres.tsx` ページを追加し、ルート `App.tsx` コンポーネントでページへのルートを有効にします。

```javascript
import FindTheatresPage from "./pages/FindTheatres";
//...<Route path="/findtheatres" element={<FindTheatresPage />} />
```

`FindTheatres.tsx` コンポーネント内の主要なロジックをいくつか見てみましょう。

### **1\. セットアップと状態管理**

標準的な React フックを使用してユーザーの入力を管理します。

* **`useSearchParams`**: 前の画面から渡された映画のタイトルやタグを取得します（例: ユーザーが特定の映画ポスターで「Find Showtimes」をクリックした場合など）。  
* **`handleUseMyLocation`**: ユーザーが都市名を入力するよりも現在地を使用したい場合に、ブラウザのネイティブ Geolocation API を使用して正確な座標（`latitude, longitude`）を取得します。

### **2\. プロンプト エンジニアリング戦略**

このコンポーネントの核心は `handleSearch` 関数です。`prompt` をどのように構築しているかよく見てください。

```json
Context: User wants to see the movie matching "${tags || movieTitle}" in a theatre.
           Location: ${location}
           Date: ${date}

           Task:
           1. Find 2-3 movies similar to "${tags || movieTitle}" currently playing in this city.
           2. Return strict JSON format.

           JSON Schema:
           {
               "movies": [
                   {
                       "title": "Movie Title",
                       "description": "Movie description",
                       "isTargetMovie": true,
                       "theatres": [
                           { "name": "Cinema Name", "showtimes": ["7:00 PM", "9:30 PM"] }
                       ]
                   }
               ]
           }
```

**なぜこれを行うのか？**

* **コンテキストの注入 (Context Injection):** `location`（場所）と `date`（日付）をプロンプトに明示的に送り込むことで、Google 検索ツールが「どこで」「いつ」検索すべきかを正確に把握できるようにします。  
* **構造化出力 (JSON モード):** LLM は通常、会話形式のテキストを出力します。しかし、UI で映画館のリストをきれいに表示するには、配列やオブジェクトが必要です。「厳密な JSON 形式（strict JSON format）」を明示的に要求し、**JSON スキーマ**を提供することで、モデルに検索結果を機械可読なコード形式に整形させます。

#### **3\. 実行と解析 (Execution and Parsing)**

プロンプト内の JSON スキーマに基づいてモデルのレスポンスをマッピングするために、以下の 2 つのインターフェースを用意しています。

```javascript
interface Theatre {
 name: string;
 showtimes: string[];
}

interface MovieResult {
 title: string;
 isTargetMovie: boolean;
 description: string;
 theatres: Theatre[];
}
```

`handleSearch` 内で、呼び出しを実行します。

1. **モデルの呼び出し:** `model.generateContent(...)` が AI をトリガーします。AI は「現在の上映時間」のリクエストを確認し、外部データが必要であることを認識して Google 検索を実行し、結果を統合します。  

2. **クリーニングと解析:**

```javascript
const cleanJson = text.replace(/```json|```/g, "").trim();
const data = JSON.parse(cleanJson);
```

3. 実行と解析
プロンプト内の JSON スキーマに基づいてモデルのレスポンスをマッピングするために、以下の2つのインターフェースを用意しています：

```TypeScript
interface Theatre {
 name: string;
 showtimes: string[];
}

interface MovieResult {
 title: string;
 isTargetMovie: boolean;
 description: string;
 theatres: Theatre[];
}
```
handleSearch 内部で、以下の呼び出しを実行します：

  1. **モデルの呼び出し**: model.generateContent(...) が AI をトリガーします。AI は「現在の上映時間」のリクエストを確認し、外部データが必要であることを認識して Google 検索を実行し、結果を合成します。
  
  2. **Clean and Parse**: `JSON.parse` がクラッシュしないように、AI が追加する可能性のあるマークダウン コードブロック（\`\`\`json など）を取り除きます。  
  
  3. **グラウンディング メタデータ (Grounding Metadata):** `response.candidates?.[0]?.groundingMetadata` を具体的に保存します。これには「証拠」、つまりデータが見つかった実際の映画館ウェブサイトへのリンクが含まれています。

#### **4\. UI レンダリング**

return ステートメントでは、Tailwind CSS を使用して表示を処理します。

* **入力セクション:** ユーザーが日付や場所を簡単に変更できる分割レイアウトです。  
* **結果ループ:** `movies` 配列をマップして表示します。

## **4\. 動作確認**

1. アプリケーションを起動します: `npm run dev`  
2. 映画をクリックし、**\[Find Theatres\]** ボタンを押します。  
3. 日付と時間を入力し、**\[Find Showtimes\]** ボタンをクリックします。  
4. 設定した場所で上映されている類似映画を Gemini が返してくれるのを待ちましょう！
