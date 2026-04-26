import { ImageResponse } from "next/og";
import { readFile } from "node:fs/promises";
import path from "node:path";

// Favicon: render logo-new.png centered inside a white circle so the tab icon
// reads clearly against dark browser chrome.
export const size = { width: 64, height: 64 };
export const contentType = "image/png";

export default async function Icon() {
  const logoBytes = await readFile(path.join(process.cwd(), "public", "logo-new.png"));
  const logoSrc = `data:image/png;base64,${logoBytes.toString("base64")}`;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "white",
          borderRadius: "50%",
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={logoSrc}
          alt="Gambit"
          width={60}
          height={60}
          style={{ objectFit: "contain" }}
        />
      </div>
    ),
    { ...size },
  );
}
