import "./globals.css";

export const metadata = {
  title: "Signal — secure smart chat",
  description: "Private messaging with an AI assistant built in.",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body className="font-body">
        {children}
        <footer style={{ textAlign: "center", padding: "12px", fontSize: "12px", opacity: 0.6 }}>
          Built by Kwadjo Owusu-Ansah Quarshie
        </footer>
      </body>
    </html>
  );
}
