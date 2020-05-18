import { Component, OnInit, ChangeDetectionStrategy } from '@angular/core';
import { Router } from '@angular/router';
import { InterpolationConfig, ThrowStmt } from '@angular/compiler';
import { faCoffee, faTrashAlt, faEdit, faPlusSquare, faRedoAlt } from '@fortawesome/free-solid-svg-icons';


declare var external: any;
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

  AddUrlMethod() {
    var columns = this.config.columns.length;

    var rows = this.config.columns[columns - 1].rows.length;
    if (rows % 2 === 0) {

      var row = { site: this.urlfile, size: 50, type: this.siteName, visible: true, isEditable: false };
      this.config.columns.push({ visible: true, size: 50, rows: [row] });
      this.config.disabled = false;
    }
    else {
      var row = { site: this.urlfile, size: 50, type: this.siteName, visible: true, isEditable: false };
      this.config.columns[columns - 1].rows.push(row);
    }
    this.siteName="";
    this.urlfile="";
    this.saveLocalStorage();
  }

  localStorageName = 'angular-split-ws'
  config: IConfig = null;
  
  ngOnInit() {
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


  onDragStart(){
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

}
