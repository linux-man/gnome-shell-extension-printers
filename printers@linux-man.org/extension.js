const Lang = imports.lang;
const Main = imports.ui.main;
const PanelMenu = imports.ui.panelMenu;
const PopupMenu = imports.ui.popupMenu;
const St = imports.gi.St;
const Gio = imports.gi.Gio;

const Clutter = imports.gi.Clutter;
const Util = imports.misc.util;
const GLib = imports.gi.GLib;
const Mainloop = imports.mainloop;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Convenience = Me.imports.convenience;

const Gettext = imports.gettext.domain('printers');
const _ = Gettext.gettext;

const printerIcon = 'printer-symbolic';
const warningIcon = 'printer-warning-symbolic';
const errorIcon = 'printer-error-symbolic';

function spawn_async(args, callback) {
    let [success, pid, in_fd, out_fd, err_fd] = GLib.spawn_async_with_pipes(null, args, null, GLib.SpawnFlags.SEARCH_PATH, null);// | GLib.SpawnFlags.DO_NOT_REAP_CHILD
    let strOUT = '';
    if(success) {
        let out_reader = new Gio.DataInputStream({base_stream: new Gio.UnixInputStream({fd: out_fd})});
        let [out, size] = out_reader.read_line(null);
        while (out !== null) {
            strOUT += out + '\n';
            [out, size] = out_reader.read_line(null);
        }
    }
    callback(strOUT);
}

function PopupIconMenuItem(icon, label) {
    let _item = new PopupMenu.PopupBaseMenuItem();
    let _icon = new St.Icon({ icon_name: icon, style_class: 'popup-menu-icon' });
    let _label = new St.Label({ text: label });
    _item.actor.add(_icon);
    _item.actor.add(_label);
    return _item;
}

const PrintersManager = new Lang.Class({
    Name: 'PrintersManager',
    Extends: PanelMenu.Button,

    _init: function() {
        this.parent(0.0, 'PrintersManager');
    this.connect_to = 0;
    this.show_icon = 0;
    this.show_error = true;
    this.show_jobs = true;
    this.job_number = true;
    this.send_to_front = true;
    this.printWarning = false;

    let hbox = new St.BoxLayout({style_class: 'panel-status-menu-box' });
    this._icon = new St.Icon({icon_name: printerIcon, style_class: 'system-status-icon'});
    this._jobs = new St.Label({y_align: Clutter.ActorAlign.CENTER, text: ''});

    hbox.add_child(this._icon);
    hbox.add_child(this._jobs);
    this.actor.add_child(hbox);

    this._settings = Convenience.getSettings();
    this._settings.connect('changed', Lang.bind(this, this.onCupsSignal));
    this._cupsSignal = Gio.DBus.system.signal_subscribe(null, 'org.cups.cupsd.Notifier', null, '/org/cups/cupsd/Notifier', null, Gio.DBusSignalFlags.NONE, this.onCupsSignal.bind(this));

    this.onCupsSignal();
    },

    onShowPrintersClicked: function() {
        if(this.connect_to == 0) Util.spawn(['gnome-control-center', 'printers']);
        else Util.spawn(['system-config-printer']);
    },

    onShowJobsClicked: function(item) {
        Util.spawn(['system-config-printer', '--show-jobs', item.printer]);
    },

    onCancelAllJobsClicked: function() {
        for(let n = 0; n < this.printers.length; n++) Util.spawn(['cancel', '-a', this.printers[n]]);
    },

    onCancelJobClicked: function(item) {
        Util.spawn(['cancel', item.job]);
    },

    onSendToFrontClicked: function(item) {
        Util.spawn(['lp', '-i', item.job, '-q 100']);
    },

    refresh: function() {
        this.connect_to = this._settings.get_enum('connect-to');
        this.show_icon = this._settings.get_enum('show-icon');
        this.show_error = this._settings.get_boolean('show-error');
        this.show_jobs = this._settings.get_boolean('show-jobs');
        this.job_number = this._settings.get_boolean('job-number')
        this.send_to_front = this._settings.get_boolean('send-to-front')

        this.menu.removeAll();
        let printers = PopupIconMenuItem(printerIcon, _('Printers'));
        printers.connect('activate', Lang.bind(this, this.onShowPrintersClicked));
        this.menu.addMenuItem(printers);
//Add Printers
        spawn_async(['/usr/bin/lpstat', '-a'], Lang.bind(this, function(out) {
            this.printers = [];
            spawn_async(['/usr/bin/lpstat', '-d'], Lang.bind(this, function(out2) {//To check default printer
                if(out2.split(': ')[1] != undefined) out2 = out2.split(': ')[1].trim();
                else out2 = 'no default';
                out = out.split('\n');
                this.printersCount = out.length - 1;
                if(this.printersCount > 0) {
                    if(this.connect_to == 1) this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
                    for(let n = 0; n < this.printersCount; n++) {
                        let printer = out[n].split(' ')[0];
                        this.printers.push(printer);
                        if(this.connect_to == 1) {
                            let printerItem = PopupIconMenuItem('emblem-documents-symbolic', printer);
                            if(out2.toString() == printer.toString()) printerItem.actor.add(new St.Icon({ icon_name: 'emblem-default-symbolic', style_class: 'popup-menu-icon' }));
                            printerItem.printer = printer;
                            printerItem.connect('activate', Lang.bind(this, this.onShowJobsClicked));
                            this.menu.addMenuItem(printerItem);
                        }
                    }
                }
//Add Jobs
                spawn_async(['/usr/bin/lpstat', '-o'], Lang.bind(this, function(out) {
//Cancel all Jobs
                    if(out.length > 0) {
                        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());
                        let cancelAll = PopupIconMenuItem('edit-delete-symbolic', _('Cancel all jobs'));
                        cancelAll.connect('activate', Lang.bind(this, this.onCancelAllJobsClicked));
                        this.menu.addMenuItem(cancelAll);
                    }
                    out = out.split(/\n/);
                    this.jobsCount = out.length - 1
                    spawn_async(['/usr/bin/lpq', '-a'], Lang.bind(this, function(out2) {
                        out2 = out2.replace(/\n/g, ' ').split(/\s+/);
                        let sendJobs = [];
                        for(var n = 0; n < out.length - 1; n++) {
                            let line = out[n].split(' ')[0].split('-');
                            let job = line.slice(-1)[0];
                            let printer = line.slice(0, -1).join('-');
                            let doc = out2[out2.indexOf(job) + 1];
                            for(var m = out2.indexOf(job) + 2; m < out2.length - 1; m++) {
                                if(isNaN(out2[m]) || out2[m + 1] != 'bytes') doc = doc + ' ' + out2[m];
                                else break;
                            }
                            if(doc.length > 30) doc = doc + '...';
                            let text = doc;
                            if(this.job_number) text += ' (' + job + ')';
                            text += ' ' + _('at') + ' ' + printer;
                            let jobItem = PopupIconMenuItem('edit-delete-symbolic', text);
                            if(out2[out2.indexOf(job) - 2] == 'active') jobItem.actor.add(new St.Icon({ icon_name: 'emblem-default-symbolic', style_class: 'popup-menu-icon' }));
                            jobItem.job = job;
                            jobItem.connect('activate', Lang.bind(jobItem, this.onCancelJobClicked));
                            this.menu.addMenuItem(jobItem);
                            if(this.send_to_front && out2[out2.indexOf(job) - 2] != 'active' && out2[out2.indexOf(job) - 2] != '1st') {
                                sendJobs.push(PopupIconMenuItem('go-up-symbolic', text));
                                sendJobs[sendJobs.length - 1].job = job;
                                sendJobs[sendJobs.length - 1].connect('activate', Lang.bind(sendJobs[sendJobs.length - 1], this.onSendToFrontClicked));
                            }
                        }
//Send to Front
                        if(this.send_to_front && sendJobs.length > 0) {
                            let subMenu = new PopupMenu.PopupSubMenuMenuItem(_('Send to front'));
                            for(let n = 0; n < sendJobs.length; n++) subMenu.menu.addMenuItem(sendJobs[n]);
                            this.menu.addMenuItem(subMenu);
                        }
//Update Icon
                        if(this.jobsCount > 0 && this.show_jobs) this._jobs.text = this.jobsCount.toString();
                        else this._jobs.text = '';
                        this.actor.show();
                        if(this.show_icon == 0 || (this.show_icon == 1 && this.printersCount > 0) || (this.show_icon == 2 && this.jobsCount > 0)) this.actor.show();
                        else this.actor.hide();
                        spawn_async(['/usr/bin/lpstat', '-l'], Lang.bind(this, function(out) {
                            this.printError = out.indexOf('Unable') >= 0 || out.indexOf(' not ') >= 0 || out.indexOf(' failed') >= 0;
                            if(this.printWarning) this._icon.icon_name = warningIcon;
                            else if(this.show_error && this.printError) this._icon.icon_name = errorIcon;
                            else this._icon.icon_name = printerIcon;
                        }));
                    }));
                }));
            }));            
        }));
    },

    onCupsSignal: function() {
        if(this.printWarning == true) return;
        this.printWarning = true;
        Mainloop.timeout_add_seconds(3, Lang.bind(this, this.warningTimeout));
        this.refresh();
    },

    warningTimeout: function() {
        this.printWarning = false;
        this.refresh();
    }
});

let printersManager;

function init() {
    Convenience.initTranslations('printers');
}

function enable() {
    printersManager = new PrintersManager();
    Main.panel.addToStatusArea('printers', printersManager);
}

function disable() {
    printersManager.destroy();
    printersManager = null;
}
