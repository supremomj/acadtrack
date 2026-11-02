// Static bootstrap runs before the body paints; it contains no user data.
export const themeBootstrap =
  "try{var t=localStorage.getItem('acadtrack.theme');if(t!=='light'&&t!=='dark'&&t!=='system')t='system';document.documentElement.dataset.theme=t==='system'?(matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'):t}catch(e){document.documentElement.dataset.theme=matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light'}";
