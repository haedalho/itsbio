"use client";

import { useEffect, useRef, useState } from "react";

declare global {
  interface Window {
    kakao?: any;
  }
}

type Props = {
  latitude: number;
  longitude: number;
  address: string;
  mapUrl: string;
};

const KAKAO_MAP_FALLBACK_KEY = "450b693c1c098ec6097cc1e5eaecbf96";

export default function KakaoOfficeMap({ latitude, longitude, address, mapUrl }: Props) {
  const mapRef = useRef<HTMLDivElement | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const appKey = process.env.NEXT_PUBLIC_KAKAO_MAP_JAVASCRIPT_KEY || KAKAO_MAP_FALLBACK_KEY;

  useEffect(() => {
    if (!appKey || !mapRef.current) {
      setFailed(true);
      return;
    }

    let cancelled = false;

    const renderMap = () => {
      if (cancelled || !mapRef.current || !window.kakao?.maps) return;
      window.kakao.maps.load(() => {
        if (cancelled || !mapRef.current) return;
        try {
          const position = new window.kakao.maps.LatLng(latitude, longitude);
          const map = new window.kakao.maps.Map(mapRef.current, {
            center: position,
            level: 3,
          });

          const marker = new window.kakao.maps.Marker({ position });
          marker.setMap(map);

          const zoomControl = new window.kakao.maps.ZoomControl();
          map.addControl(zoomControl, window.kakao.maps.ControlPosition.RIGHT);

          const overlay = new window.kakao.maps.CustomOverlay({
            position,
            yAnchor: 2.15,
            content: `
              <div style="padding:8px 12px;border-radius:999px;background:#071d43;color:white;font-size:12px;font-weight:700;box-shadow:0 8px 24px rgba(15,23,42,.18);white-space:nowrap;border:1px solid rgba(255,255,255,.7)">
                ITS BIO · Seoul Office
              </div>
            `,
          });
          overlay.setMap(map);
          setReady(true);
          setFailed(false);
        } catch {
          setFailed(true);
        }
      });
    };

    if (window.kakao?.maps) {
      renderMap();
      return () => {
        cancelled = true;
      };
    }

    const existing = document.querySelector<HTMLScriptElement>('script[data-kakao-map-sdk="true"]');
    if (existing) {
      existing.addEventListener("load", renderMap, { once: true });
      existing.addEventListener("error", () => setFailed(true), { once: true });
      return () => {
        cancelled = true;
        existing.removeEventListener("load", renderMap);
      };
    }

    const script = document.createElement("script");
    script.src = `https://dapi.kakao.com/v2/maps/sdk.js?appkey=${encodeURIComponent(appKey)}&autoload=false`;
    script.async = true;
    script.dataset.kakaoMapSdk = "true";
    script.onload = renderMap;
    script.onerror = () => setFailed(true);
    document.head.appendChild(script);

    return () => {
      cancelled = true;
    };
  }, [appKey, latitude, longitude]);

  return (
    <div className="relative h-full w-full overflow-hidden bg-[#f6f1d8]">
      <div ref={mapRef} className={`h-full w-full transition-opacity duration-500 ${ready ? "opacity-100" : "opacity-0"}`} />

      {!ready ? (
        <div className="absolute inset-0 flex items-center justify-center overflow-hidden bg-[#f7f4df]">
          <div className="absolute inset-0 opacity-50" style={{ backgroundImage: "linear-gradient(rgba(25,25,25,.08) 1px, transparent 1px), linear-gradient(90deg, rgba(25,25,25,.08) 1px, transparent 1px)", backgroundSize: "36px 36px" }} />
          <div className="absolute left-[14%] top-[18%] h-2 w-[72%] rotate-[-8deg] rounded-full bg-white/80 shadow-sm" />
          <div className="absolute left-[24%] top-[10%] h-[80%] w-2 rotate-[18deg] rounded-full bg-white/80 shadow-sm" />
          <div className="relative z-10 mx-6 max-w-md rounded-[24px] border border-black/10 bg-white/95 p-6 text-center shadow-[0_18px_45px_rgba(15,23,42,.12)] backdrop-blur">
            <div className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[#fee500] text-xl font-black text-[#191919]">K</div>
            <div className="mt-4 text-sm font-bold text-[#191919]">ITS BIO · Seoul Office</div>
            <p className="mt-2 text-xs leading-6 text-slate-600">{address}</p>
            <a href={mapUrl} target="_blank" rel="noreferrer" className="mt-5 inline-flex h-10 items-center justify-center rounded-full bg-[#fee500] px-5 text-xs font-bold text-[#191919] transition hover:brightness-95">
              Kakao Map에서 위치 보기 →
            </a>
            {failed ? <div className="mt-3 text-[11px] text-slate-500">카카오맵을 불러오지 못했습니다. Kakao Developers의 JavaScript SDK 도메인 등록을 확인해 주세요.</div> : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}
