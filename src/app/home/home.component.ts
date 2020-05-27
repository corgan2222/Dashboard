import { Component, OnInit, ChangeDetectionStrategy, ElementRef } from '@angular/core';
import { Router } from '@angular/router';
import { InterpolationConfig, ThrowStmt } from '@angular/compiler';
import { faCoffee, faTrashAlt, faEdit, faPlusSquare, faRedoAlt } from '@fortawesome/free-solid-svg-icons';

//declare var external: any;
declare var $: any;

interface IConfig {
  columns: Array<{
    visible: boolean,
    size: number,
    rows: Array<{
      visible: boolean,
      size: number,
      type: string,
      site: string,
      isEditable: boolean
    }>
  }>
  disabled: boolean
}


const defaultConfig: IConfig = {
  columns: [
    {
      visible: true,
      size: 60,
      rows: [
        { visible: true, size: 50, type: 'Grafana', site: 'https://grafana.com/login', isEditable: false },
        { visible: true, size: 50, type: 'Slack', site: 'https://slack.com/signin#/', isEditable: false }
      ]
    },
    {
      visible: true,
      size: 40,
      rows: [
        { visible: true, size: 70, type: 'WhatsappWeb', site: 'https://web.whatsapp.com', isEditable: false },
        // { visible: true, size: 30, type: 'doc', site: 'https://www.google.com', isEditable: false }
      ]
    },
    /*
    {
      visible: true,
      size: 25,
      rows: [
        { visible: true, size: 50, type: 'Slack', site: 'https://slack.com/signin#/', isEditable: false },
       // { visible: true, size: 50, type: 'Logs', site: 'https://m.facebook.com/', isEditable: false }
      ]
    } */
  ],
  disabled: false
};

@Component({
  selector: 'app-home',
  changeDetection: ChangeDetectionStrategy.OnPush,
  templateUrl: './home.component.html',
  styleUrls: ['./home.component.scss']
})
export class HomeComponent implements OnInit {
  urls: Array<string> = [];
  urlfile: string = "";
  siteName: string = "";
  addConfig: IConfig;
  editurl: string = "";
  editsiteName: string = ""
  rowedit: number;
  coledit: number;
  faCoffee = faCoffee;
  fatrash = faTrashAlt;
  faedit = faEdit;
  faAdd = faPlusSquare;
  faRedoAlt = faRedoAlt;

  constructor(private router: Router) {

  }
  isColumnsOnly = false;

  AddUrlMethod() {
    var columns = this.config.columns.length;

    var rows = this.config.columns[columns - 1].rows.length;
    if (rows % 2 != 0 && !this.isColumnsOnly) {
      var row = { site: this.urlfile, size: 50, type: this.siteName, visible: true, isEditable: false };
      this.config.columns[columns - 1].rows.push(row);
    }
    else {
      var row = { site: this.urlfile, size: 50, type: this.siteName, visible: true, isEditable: false };
      this.config.columns.push({ visible: true, size: 50, rows: [row] });
      this.config.disabled = false;
    }
    this.siteName = "";
    this.urlfile = "";
    this.saveLocalStorage();
  }

  toggleColumns() {
    this.isColumnsOnly = !this.isColumnsOnly;
    let tmpConfig = { columns: [], disabled: false };
    if (this.isColumnsOnly) {
      for (let i in this.config.columns) {
        for (let j in this.config.columns[i].rows) {
          tmpConfig.columns.push({
            visible: this.config.columns[i].visible,
            size: this.config.columns[i].size,
            rows: [
              { visible: this.config.columns[i].rows[j].visible, size: 100, type: this.config.columns[i].rows[j].type, site: this.config.columns[i].rows[j].site, isEditable: this.config.columns[i].rows[j].isEditable },
            ]
          })
        }
      }
    }
    else {
      let tmpIndex = 0;
      for (let i in this.config.columns) {
        this.config.columns[i].rows[0].size = this.config.columns[i].rows[0].size / 2;
        console.log((parseInt(i) + 1));
        if ((parseInt(i) + 1) % 2 != 0) {
          tmpConfig.columns.push({
            visible: this.config.columns[i].visible,
            size: this.config.columns[i].size,
            rows: this.config.columns[i].rows
          })
          tmpIndex++;
        }
        else {
          console.log(tmpConfig);
          console.log(tmpIndex);
          tmpConfig.columns[tmpIndex - 1].rows.push(this.config.columns[i].rows[0]);
        }
      }

    }
    console.log(tmpConfig);
    tmpConfig.disabled = this.config.disabled;
    this.config = (tmpConfig as any);
    localStorage.setItem("isColumnsOnly", JSON.stringify(this.isColumnsOnly));
    this.saveLocalStorage();
  }

  localStorageName = 'angular-split-ws'
  config: IConfig = null;
  preload = '';
  ngOnInit() {
    this.preload = encodeURI("file://" + __dirname + "/assets/preload.js");
    console.log(this.preload);
    this.isColumnsOnly = JSON.parse(localStorage.getItem("isColumnsOnly"));
    if (localStorage.getItem(this.localStorageName)) {
      this.config = JSON.parse(localStorage.getItem(this.localStorageName));
    }
    else {
      //  this.config = defaultConfig;
      localStorage.setItem("default", JSON.stringify(defaultConfig));
      this.resetConfig();
    }
  }

  AddForm() {
    $("#exampleModalCenter").show();
    this.config = Object.assign({}, defaultConfig);
  }

  resetConfig() {
    this.isColumnsOnly = false;
    localStorage.setItem("isColumnsOnly", JSON.stringify(this.isColumnsOnly));
    localStorage.removeItem(this.localStorageName);
    this.config = JSON.parse(localStorage.getItem("default"));
    this.refreshColumnVisibility()
  }


  EditRow(irow: any, icol: any) {
    this.rowedit = null;
    this.coledit = null;
    this.editsiteName = "";
    this.editurl = "";
    this.config.columns[icol].rows[irow].isEditable = true;
    this.editsiteName = this.config.columns[icol].rows[irow].type;
    this.editurl = this.config.columns[icol].rows[irow].site;
    this.rowedit = irow;
    this.coledit = icol;
  }


  EditMethod() {
    this.config.columns[this.coledit].rows[this.rowedit].site = this.editurl;
    this.config.columns[this.coledit].rows[this.rowedit].type = this.editsiteName;
    this.config.columns[this.coledit].rows[this.rowedit].isEditable = false;
    this.editurl = "";
    this.editsiteName = "";
  }


  DeleteRow(irow: any, icol: any) {

    if (irow % 2 === 0) {
      if (this.config.columns[icol].rows.length <= 1) {
        this.config.columns.splice(icol, 1);
      }
      else {
        this.config.columns[icol].rows.splice(irow, 1);

      }
    }
    else {
      if (this.config.columns[icol].rows.length <= 1) {
        this.config.columns.splice(icol, 1);
      }
      else {
        this.config.columns[icol].rows.splice(irow, 1);
      }

    }
    this.saveLocalStorage();
  }

  isWebviewShow = true;
  onDragEnd(columnindex: number, e: { gutterNum: number, sizes: Array<number> }) {
    // Column dragged
    this.isWebviewShow = true;
    console.log("drag end")
    if (columnindex === -1) {
      // Set size for all visible columns
      this.config.columns.filter(c => c.visible === true).forEach((column, index) => column.size = e.sizes[index]);
    }
    // Row dragged
    else {
      // Set size for all visible rows from specified column
      this.config.columns[columnindex].rows.filter(r => r.visible === true).forEach((row, index) => row.size = e.sizes[index]);
    }

    this.saveLocalStorage();
  }


  onDragStart() {
    this.isWebviewShow = false;
    console.log("drag start")
  }


  toggleDisabled() {
    this.config.disabled = !this.config.disabled;

    this.saveLocalStorage();
  }

  refreshColumnVisibility() {
    // Refresh columns visibility based on inside rows visibilities (If no row > hide column)
    console.log(defaultConfig);
    this.config.columns.forEach((column, index) => {
      column.visible = column.rows.some(row => row.visible === true);
    });

    this.saveLocalStorage();
  }

  saveLocalStorage() {
    localStorage.setItem(this.localStorageName, JSON.stringify(this.config));
  }

  getWebViewId(url) {
    let id = url.split('.c')[0];
    id = id.split('//')[1];
    id = id.toLowerCase();
    console.log("webview id:", id);
    return id;
  }

  webview;
  isDefaultCSS = false;
  customCSS = 'html[dir] .landing-wrapper:before { background-color: #00a5f4 !important; } .page-footer {display: none  !important;} .p-workspace.p-workspace--context-pane-collapsed.p-workspace--classic-nav.p-workspace--iap1 { grid-template-columns: 0px auto !important; }';
  loadCustomCss(manual) {

    if (this.isDefaultCSS)
      return;

    localStorage.setItem("CustomCSS", JSON.stringify(this.customCSS));
    console.log("loading css...");
    this.webview = document.getElementsByClassName('appHandler');

    if (manual) {
      for (var i = 0; i < this.webview.length; i++) {
        console.log("updating css");
        (this.webview[i] as any).insertCSS(this.customCSS);

      }
    }
    else {
      this.webview[this.webview.length - 1].addEventListener('dom-ready', () => {
        //        this.webview[1].openDevTools();
        for (var i = 0; i < this.webview.length; i++) {
          console.log("appling css");
          (this.webview[i] as any).insertCSS(this.customCSS);
        }
      });
    }

  }
  defaultCSS() {
    this.isDefaultCSS = !this.isDefaultCSS;
    localStorage.setItem("isDefaultCSS", JSON.stringify(this.isDefaultCSS));
    this.webview = document.getElementsByClassName('appHandler');

    for (var i = 0; i < this.webview.length; i++) {
      console.log("reloading webview ...");
      (this.webview[i] as any).reload();

    }
  }

  ngAfterViewInit() {
    let tempCustomCSS = JSON.parse(localStorage.getItem("CustomCSS"));
    if(tempCustomCSS){
      this.customCSS = tempCustomCSS;
    }
    
    let tempIsDefaultCSS = JSON.parse(localStorage.getItem("isDefaultCSS"));
    if(tempIsDefaultCSS){
      this.isDefaultCSS = tempIsDefaultCSS;
    }

    console.log(this.isDefaultCSS, this.customCSS );

    setTimeout(() => {
      this.loadCustomCss(false)
    }, 1000)
  }

}
