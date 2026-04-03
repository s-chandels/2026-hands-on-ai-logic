# **Firebase AI Logic でリアルタイムのローカル映画検索を構築する**

* **前提条件:** [Build with Firebase Data Connect (web)](https://firebase.google.com/codelabs/firebase-dataconnect-web) コードラボの完了。
* **トピック:** Gemini 3 Flash と Google 検索のグラウンディング（Grounding）を使用した「AI Logic」の実装。

## **1. 概要**

前回のコードラボでは、Firebase Data Connect と Cloud SQL を使用して堅牢な映画レビュー アプリケーションを構築しました。 `Movies`（映画）、`Reviews`（レビュー）、`Users`（ユーザー）のスキーマを定義し、それらをフィルタリングする UI を作成しました。

標準的なデータベース クエリは、「2024年に公開された映画を探す」といった構造化されたデータに対しては非常に優れています。 しかし、以下の 2 種類のユーザー ニーズには対応しきれないことがあります。

1.  **曖昧または概念的な意図:** 「温かいハグのような（ほっこりする）映画が見たい。」
2.  **リアルタイムの世界知識:** 「今、ダウンタウンの映画館で上映されている、これに似た映画は何？」

このモジュールでは、**Firebase AI Logic** を実装して、このギャップを埋めていきます。

### **アーキテクチャ**

アプリの大部分はそのまま残します。これらのユーザー ニーズを満たす新機能を実装するために、基本的なコンポーネントやデータベース スキーマを変更する必要はありません。

その代わりに、構築済みのものの上に「AI エージェント」機能を追加し、映画データベースにある作品と似た映画で、かつ近所や任意の場所でリアルタイムに上映されているものを検索できるようにします。

ここでの **AI エージェントの使用パターン** は以下の通りです。

1.  **Gemini 3 を使用して、現在リアルタイムで上映中の類似映画を検索する:** Firebase AI Logic と Gemini 3 を使用し、ユーザーが現在表示している映画のメタデータと希望する場所を提供することで、マルチモーダル検索を行います。
2.  **要件を満たすために AI エージェントが使用すべきツールを指定する:** （例: Google 検索の使用など）。
3.  **Gemini からアプリに返してほしいレスポンス データの形式を指定する:** アプリ内で表示しやすい形式を指定します。
4.  **レスポンス データを処理する:** Web アプリケーションのページに表示します。

### **構築するもの**

* **AI Logic サービス:** Google 検索ツールを使用して Gemini にクエリを送信するクライアントサイド サービス。
* **構造化プロンプティング:** コード内で利用可能な JSON データを AI に強制的に返させるテクニック。

## **2. Firebase コンソールで Firebase AI Logic API を有効にする**

今回のコードラボの一部として「Firebase AI Logic」を使用します。 以下の手順に従って、Cloud プロジェクトで Firebase AI Logic を有効にしてください。

1.  [Cloud コンソール](https://cloud.google.com/console)の製品検索バーで「Firebase」を検索し、検索結果から Firebase をクリックします。
2.  下にスクロールして、Firebase 製品リストの中から「Firebase AI Logic」を見つけます。
3.  [使ってみる (Get Started)] をクリックし、Firebase コンソールへの移動を承認します。

![Get started with Firebase AI Logic from the Cloud console](codelab-images/image-1-get-started-with-firebase-ai-logic.png) 

4.  Firebase コンソールに移動すると、以下のページが表示されます。

![Firebase project creation page](codelab-images/image-2-get-started-with-firebase.png) 

5.  [Firebase を使ってみる] をクリックすると、以下のプロジェクト セットアップ ページが表示されます。

![Project setup steps](codelab-images/image-3-project-setup-steps.png)

5.  以下の点に注意して、プロジェクト セットアップの手順を進めてください。
    * 新しい Firebase プロジェクト名を入力して新規作成するのではなく、上のスクリーンショットでハイライトされている **「Google Cloud プロジェクトに Firebase を追加」** を選択し、以前に作成した Google Cloud プロジェクトを選択します。
    * 「Firebase の利用規約に同意する」にチェックを入れます。
    * 「Google アナリティクス」の設定では、このプロジェクトの Google アナリティクスを **OFF** にして [続行] をクリックします。
    * Firebase プロジェクトが設定され、以下のページが表示されます。

![Get started with Firebase AI Logic in the Firebase console](codelab-images/image-4-firebase-ai-logic-get-started.png)

6.  [使ってみる] ボタンをクリックして、Firebase AI Logic を有効にします。

7.  Gemini Developer API で、[この API を使ってみる] をクリックします。 （Vertex AI Gemini API も利用可能ですが、現在はバグにより正常に動作しない可能性があります）。

![Select Gemini Developer API onboarding page](codelab-images/image-5-select-gemini-developer-api.png)

以下の手順を完了してください。
  - [API を有効にする] をクリックします。
  - 「AI モニタリングを有効にする」ステップはスキップして構いません。
  - 「開始するにはアプリを追加してください」画面で、Web アプリのアイコンをクリックします。

  以下の画面が表示されます。

  ![Add Firebase to your web app](codelab-images/image-6-add-firebase-to-your-web-app.png)

8.  Web アプリに任意の名前を付け、[アプリを登録] をクリックします。 次に、以下のような画面が表示されます。

![Project configuration settings screen](codelab-images/image-7-project-config-screen.png)

9.  スクリーンショットに示されている、プロジェクト構成（Firebase configuration）セクションをコピーします。

10. この内容を、ローカル環境の `firebase.tsx (app/src/lib/firebase.tsx)` ファイル内にあるプロジェクト構成設定に貼り付けて置換します。

![Replace project configuration settings in your local dev environment](codelab-images/image-8-replace-project-configurations.png)

11. Firebase コンソールに戻り、[コンソールへ移動]、[続行] の順にクリックしてセットアップを完了します。

## **3. アプリケーションで Firebase AI Logic をセットアップする**

クライアント アプリケーションから Gemini モデルに直接アクセスするために、Firebase AI Logic SDK を使用します。

### **1. Firebase AI Logic SDK を有効にする**

1.  `firebase.tsx (app/src/lib/firebase.tsx)` の上部にある import 文に、以下を**追加**します。

```javascript
import { getAI, getGenerativeModel, GoogleAIBackend } from "firebase/ai";