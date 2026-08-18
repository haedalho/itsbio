type LegacyNoticeHtmlProps = {
  html: string;
};

export default function LegacyNoticeHtml({ html }: LegacyNoticeHtmlProps) {
  return (
    <div className="mt-10">
      <style>{`
        .legacy-notice-html {
          width: 100%;
          max-width: 860px;
          margin: 0 auto;
          color: #334155;
          font-size: 15px;
          line-height: 1.7;
          overflow-wrap: anywhere;
        }
        .legacy-notice-html * {
          box-sizing: border-box;
        }
        .legacy-notice-html table {
          border-collapse: collapse;
          max-width: 100%;
        }
        .legacy-notice-html td,
        .legacy-notice-html th {
          vertical-align: top;
        }
        .legacy-notice-html img {
          display: block;
          max-width: 100% !important;
          height: auto !important;
        }
        .legacy-notice-html p {
          max-width: 100%;
        }
        .legacy-notice-html a {
          color: #c2410c;
          text-decoration: none;
        }
        .legacy-notice-html a:hover {
          text-decoration: underline;
        }
        @media (max-width: 767px) {
          .legacy-notice-scroll {
            overflow-x: auto;
            -webkit-overflow-scrolling: touch;
          }
          .legacy-notice-html {
            min-width: 0;
            font-size: 14px;
          }
          .legacy-notice-html table {
            width: 100% !important;
          }
          .legacy-notice-html td,
          .legacy-notice-html th {
            max-width: 100%;
          }
        }
      `}</style>
      <div className="legacy-notice-scroll">
        <div
          className="legacy-notice-html"
          dangerouslySetInnerHTML={{ __html: html }}
        />
      </div>
    </div>
  );
}
