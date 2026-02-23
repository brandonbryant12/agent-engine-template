export const generateRootHtml = (webUrl: string, serverUrl: string) => `
  <!DOCTYPE html>
  <html lang="en">
    <head>
      <meta charset="UTF-8" />
      <title>Template App API</title>
      <style>
        :root { color-scheme: light dark; }
        body {
          font-family: system-ui, sans-serif;
          display: flex;
          flex-direction: column;
          align-items: center;
          margin: 0;
          padding: 2rem;
          margin-top: 3rem;
        }
        h1 {
          font-size: 2.5rem;
          margin-bottom: 1rem;
          text-align: center;
        }
        hr {
          width: 60%;
          border: none;
          border-top: 2px solid #888;
          margin: 1rem 0 2rem;
        }
        h2 {
          font-size: 1.75rem;
          margin-bottom: 1rem;
          text-align: center;
        }
        p {
          font-size: 1.25rem;
          margin: 0 0 1rem;
          text-align: center;
        }
        ul {
          list-style: disc;
          padding-left: 1.5rem;
          margin: 0 0 2rem;
        }
        li {
          margin-bottom: 0.75rem;
          font-size: 1.1rem;
        }
        a { text-decoration: underline; }
      </style>
    </head>
    <body>
      <h1>Template App API</h1>
      <hr />
      <h2>Resources</h2>
      <ul>
        <li>
          <a href="${webUrl}" target="_blank" rel="noreferrer">
            Web (frontend)
          </a>
        </li>
        <li>
          <a href="${serverUrl}/api" target="_blank" rel="noreferrer">
            API - OpenAPI Reference (Scalar)
          </a>
        </li>
        <li>
          <a href="${serverUrl}/api/auth/reference" target="_blank" rel="noreferrer">
            Auth - OpenAPI Reference (Scalar)
          </a>
        </li>
      </ul>
    </body>
  </html>
`;
