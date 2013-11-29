var da_ua = window.navigator.userAgent.toLowerCase();
var da_br = ""; 

if ( /windows ce/.test( da_ua ) && /polar/.test( da_ua ) ) {
	da_br = "WM_POLARIS_LGT";
} else if ( /mozilla/.test( da_ua ) && /natebrowser/.test( da_ua ) ) {
	da_br = "POLARIS_SKT";
} else if ( /opera/.test( da_ua ) && (/windows ce/.test( da_ua ) || /skt/.test( da_ua )) ) {
	da_br = "OPERA";
} else if ( /iphone/.test( da_ua ) || /ipod/.test( da_ua ) ) {
	da_br = "SAFARI";
} else if ( /android/.test( da_ua ) ) {
	da_br = "ANDROID_WEBKIT";
} else if ( /dolfin/.test( da_ua )) {
	da_br = "DOLFIN";
} else if ( /windows ce/.test( da_ua ) && /iemobile/.test( da_ua ) ) {
	da_br = "IE";
} else if ( /mozilla/.test( da_ua ) &&  /(wv[0-9]+)/.test( da_ua ) && /lgtelecom/.test( da_ua ) ) {
	da_br = "LGT_WEBVIEWER";
} else if ( (/mozilla/.test( da_ua ) && /((010|011|016|017|018|019)\d{3,4}\d{4}$)/.test( da_ua )) ){
	da_br = "POLARIS_LGT";
} else {
	da_br = "OTHERS";
}