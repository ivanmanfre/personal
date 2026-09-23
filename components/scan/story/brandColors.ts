export function contrastInk(hex:string){
 const rgb=[1,3,5].map(i=>parseInt(hex.slice(i,i+2),16)/255).map(c=>c<=.04045?c/12.92:((c+.055)/1.055)**2.4);
 return .2126*rgb[0]+.7152*rgb[1]+.0722*rgb[2]>.179?'#000000':'#ffffff';
}
/** Keep a supplied monochrome logo legible when its website uses another background. */
export function logoFilter(url:string|undefined,surface:string){
 if(url&&/white|light/i.test(url)&&contrastInk(surface)==='#000000')return 'brightness(0)';
 if(url&&/black|dark/i.test(url)&&contrastInk(surface)==='#ffffff')return 'brightness(0) invert(1)';
 return undefined;
}
