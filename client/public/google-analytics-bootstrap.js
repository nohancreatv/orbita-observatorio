(function () {
  window.dataLayer = window.dataLayer || [];
  window.gtag = window.gtag || function () {
    window.dataLayer.push(arguments);
  };
  window.gtag("consent", "default", {
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
    analytics_storage: "denied",
    wait_for_update: 500,
    ads_data_redaction: true
  });
  window.gtag("js", new Date());
  window.gtag("config", "G-4EQ06VWWVE", { send_page_view: false });
})();
