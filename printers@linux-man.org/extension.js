import Clutter from 'gi://Clutter';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import GObject from 'gi://GObject';
import St from 'gi://St';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import {Extension, gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';

const printerIcon = 'printer-symbolic';
const warningIcon = 'printer-warning-symbolic';
const errorIcon = 'printer-error-symbolic';

let _timeout = null;

function exec_command(args) {
    try {
        let proc = Gio.Subprocess.new(args, Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE);
    }
    catch (e) {
        logError(e);
    }
}

function exec_async(args) {
    return new Promise((resolve, reject) => {
        let strOUT = '';
        try {
            let proc = Gio.Subprocess.new(args, Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_PIPE);
            proc.communicate_utf8_async(null, null, (proc, res) => {
                try {
                    let [, stdout, stderr] = proc.communicate_utf8_finish(res);
                    if(proc.get_successful()) strOUT = stdout;
                }
                catch (e) {
                    logError(e);
                }
                finally {
                    resolve(strOUT);
                }
            });
        }
        catch (e) {
            logError(e);
        }
    })
}

function PopupIconMenuItem(icon, label) {
    let _item = new PopupMenu.PopupImageMenuItem(label, icon, {});
    return _item;
}

const PrintersManager = GObject.registerClass(class PrintersManager extends PanelMenu.Button {

    _init(settings) {
        super._init(null, 'PrintersManager')
        this.connect_to = 0;
        this.show_icon = 0;
        this.show_error = true;
        this.show_jobs = true;
        this.job_number = true;
        this.send_to_front = true;
        this.printWarning = false;
        this.updating = false;
        this.menuIsOpen = false;
        this._settings = settings;
        this._settings.connect('changed', this.onCupsSignal.bind(this));

        let hbox = new St.BoxLayout({style_class: 'panel-status-menu-box' });
        this._icon = new St.Icon({icon_name: printerIcon, style_class: 'system-status-icon'});
        this._jobs = new St.Label({y_align: Clutter.ActorAlign.CENTER, text: ''});

        hbox.add_child(this._icon);
        hbox.add_child(this._jobs);
        this.add_child(hbox);

        this.menu.connect('open-state-changed', (self, open) => {
            this.menuIsOpen = open;
        });

        this._cupsSignal = Gio.DBus.system.signal_subscribe(null, 'org.cups.cupsd.Notifier', null, '/org/cups/cupsd/Notifier', null, Gio.DBusSignalFlags.NONE, this.onCupsSignal.bind(this));

        this.onCupsSignal();
    }

    onShowPrintersClicked() {
        if(this.connect_to == 0) exec_command(['gnome-control-center', 'printers']);
        else exec_command(['system-config-printer']);
    }

    onShowJobsClicked(item) {
        exec_command(['system-config-printer', '--show-jobs', item.printer]);
    }

    onCancelAllJobsClicked() {
        for(let n = 0; n < this.printers.length; n++) exec_command(['cancel', '-a', this.printers[n]]);
    }

    onCancelJobClicked(item) {
        exec_command(['cancel', item.job]);
    }

    onSendToFrontClicked(item) {
        exec_command(['lp', '-i', item.job, '-q 100']);
    }

    async refresh() {
        if (this.menuIsOpen || this.updating) return;
        this.updating = true;
        this.connect_to = this._settings.get_enum('connect-to');
        this.show_icon = this._settings.get_enum('show-icon');
        this.show_error = this._settings.get_boolean('show-error');
        this.show_jobs = this._settings.get_boolean('show-jobs');
        this.job_number = this._settings.get_boolean('job-number')
        this.send_to_front = this._settings.get_boolean('send-to-front')

        this.menu.removeAll();
        let printers = PopupIconMenuItem(printerIcon, _('Printers'));
        printers.connect('activate', this.onShowPrintersClicked.bind(this));
        this.menu.addMenuItem(printers);
//Add Printers
        this.printers = [];
        let p_list = await exec_async(['/usr/bin/lpstat', '-a']);
        let p_default = await exec_async(['/usr/bin/lpstat', '-d']);
        if(p_default.split(': ')[1] != undefined) p_default = p_default.split(': ')[1].trim();
        else p_default = 'no default';
        p_list = p_list.split('\n');
        this.printersCount = p_list.length - 1;
        if(this.printersCount > 0) {
            if(this.connect_to == 1) this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
            for(let n = 0; n < this.printersCount; n++) {
                let printer = p_list[n].split(' ')[0];
                this.printers.push(printer);
                if(this.connect_to == 1) {
                    let printerItem = PopupIconMenuItem('emblem-documents-symbolic', printer);
                    if(p_default.toString() == printer.toString()) printerItem.setOrnament(PopupMenu.Ornament.CHECK);
                    printerItem.printer = printer;
                    printerItem.connect('activate', this.onShowJobsClicked.bind(this));
                    this.menu.addMenuItem(printerItem);
                }
            }
        }
//Jobs
        let p_jobs = await exec_async(['/usr/bin/lpstat', '-o']);
//Cancel all Jobs
        if(p_jobs.length > 0) {
            this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
            let cancelAll = PopupIconMenuItem('edit-delete-symbolic', _('Cancel all jobs'));
            cancelAll.connect('activate', this.onCancelAllJobsClicked.bind(this));
            this.menu.addMenuItem(cancelAll);
        }
//Add Jobs
        p_jobs = p_jobs.split(/\n/);
        this.jobsCount = p_jobs.length - 1
        let p_jobs2 = await exec_async(['/usr/bin/lpq', '-a']);
        p_jobs2 = p_jobs2.replace(/\n/g, ' ').split(/\s+/);
        let sendJobs = [];
        for(var n = 0; n < p_jobs.length - 1; n++) {
            let line = p_jobs[n].split(' ')[0].split('-');
            let job = line.slice(-1)[0];
            let printer = line.slice(0, -1).join('-');
            let doc = p_jobs2[p_jobs2.indexOf(job) + 1];
            for(var m = p_jobs2.indexOf(job) + 2; m < p_jobs2.length - 1; m++) {
                if(isNaN(p_jobs2[m]) || p_jobs2[m + 1] != 'bytes') doc = doc + ' ' + p_jobs2[m];
                else break;
            }
            if(doc.length > 30) doc = doc + '...';
            let text = doc;
            if(this.job_number) text += ' (' + job + ')';
            text += ' ' + _('at') + ' ' + printer;
            let jobItem = PopupIconMenuItem('edit-delete-symbolic', text);
            if(p_jobs2[p_jobs2.indexOf(job) - 2] == 'active') jobItem.setOrnament(PopupMenu.Ornament.CHECK);
            jobItem.job = job;
            jobItem.connect('activate', this.onCancelJobClicked.bind(jobItem));
            this.menu.addMenuItem(jobItem);
            if(this.send_to_front && p_jobs2[p_jobs2.indexOf(job) - 2] != 'active' && p_jobs2[p_jobs2.indexOf(job) - 2] != '1st') {
                sendJobs.push(PopupIconMenuItem('go-up-symbolic', text));
                sendJobs[sendJobs.length - 1].job = job;
                sendJobs[sendJobs.length - 1].connect('activate', this.onSendToFrontClicked.bind(sendJobs[sendJobs.length - 1]));
            }
        }
//Send to Front
        if(this.send_to_front && sendJobs.length > 0) {
            let subMenu = new PopupMenu.PopupSubMenuMenuItem(_('Send to front'));
            for(let n = 0; n < sendJobs.length; n++) subMenu.menu.addMenuItem(sendJobs[n]);
            this.menu.addMenuItem(subMenu);
        }
        this.updating = false;
//Update Icon
        if(this.jobsCount > 0 && this.show_jobs) this._jobs.text = this.jobsCount.toString();
        else this._jobs.text = '';
        this.show();
        if(this.show_icon == 0 || (this.show_icon == 1 && this.printersCount > 0) || (this.show_icon == 2 && this.jobsCount > 0)) {
			this.show();
			let p_error = await exec_async(['/usr/bin/lpstat', '-l']);
			this.printError = p_error.indexOf('Unable') >= 0 || p_error.indexOf(' not ') >= 0 || p_error.indexOf(' failed') >= 0;
			if(this.printWarning) this._icon.icon_name = warningIcon;
			else if(this.show_error && this.printError) this._icon.icon_name = errorIcon;
			else this._icon.icon_name = printerIcon;
		}
        else this.hide();
    }

    onCupsSignal() {
        if(this.printWarning == true) return;
        this.printWarning = true;
        _timeout = GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 3, this.warningTimeout.bind(this));
        this.refresh();
    }

    warningTimeout() {
        this.printWarning = false;
        this.refresh();
    }
});

let printersManager;

export default class Printers extends Extension {

    enable() {
        printersManager = new PrintersManager(this.getSettings());
        Main.panel.addToStatusArea('printers', printersManager);
    }

    disable() {
        if(_timeout) {
            GLib.Source.remove(_timeout);
            _timeout = null;
        }
        printersManager.destroy();
        printersManager = null;
    }

}
