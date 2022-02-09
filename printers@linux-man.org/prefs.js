// -*- mode: js2; indent-tabs-mode: nil; js2-basic-offset: 4 -*-
/* exported init buildPrefsWidget */

const { Gio, GObject, Gtk } = imports.gi;

const Gettext = imports.gettext.domain('printers');
const _ = Gettext.gettext;

const ExtensionUtils = imports.misc.extensionUtils;

function init() {
    ExtensionUtils.initTranslations('printers');
}

const PrintersPrefsWidget = GObject.registerClass(class PrintersPrefsWidget extends Gtk.Box {
    _init() {
        super._init({
            orientation: Gtk.Orientation.VERTICAL,
            spacing: 6,
            margin_top: 36,
            margin_bottom: 36,
            margin_start: 36,
            margin_end: 36,
            halign: Gtk.Align.CENTER,
        });

        this._settings = ExtensionUtils.getSettings();

        //interface
        let label = new Gtk.Label({label: _('Interface') + ': ', xalign: 0, hexpand: true});
        let model = new Gtk.ListStore();
        model.set_column_types([GObject.TYPE_INT, GObject.TYPE_STRING]);
        this._interfaceCombo = new Gtk.ComboBox({model: model});
        let renderer = new Gtk.CellRendererText();
        this._interfaceCombo.pack_start(renderer, true);
        this._interfaceCombo.add_attribute(renderer, 'text', 1);
        let iter = model.append();
        model.set(iter, [0, 1], [0, _('Gnome Control Center')]);
        iter = model.append();
        model.set(iter, [0, 1], [1, _('system-config-printer')]);
        this._interfaceCombo.connect('changed', (entry) => {
            let [success, iter] = this._interfaceCombo.get_active_iter()
            if (success) this._settings.set_enum('connect-to', this._interfaceCombo.get_model().get_value(iter, 0));
        });
        this.append(label);
        this.append(this._interfaceCombo);

        //show-icon
        label = new Gtk.Label({label: _('Show icon') + ': ', xalign: 0, hexpand: true});
        model = new Gtk.ListStore();
        model.set_column_types([GObject.TYPE_INT, GObject.TYPE_STRING]);
        this._showIconCombo = new Gtk.ComboBox({model: model});
        renderer = new Gtk.CellRendererText();
        this._showIconCombo.pack_start(renderer, true);
        this._showIconCombo.add_attribute(renderer, 'text', 1);
        iter = model.append();
        model.set(iter, [0, 1], [0, _('Always')]);
        iter = model.append();
        model.set(iter, [0, 1], [1, _('When printers exist')]);
        iter = model.append();
        model.set(iter, [0, 1], [2, _('When printing')]);
        this._showIconCombo.connect('changed', (entry) => {
            let [success, iter] = this._showIconCombo.get_active_iter()
            if (success) this._settings.set_enum('show-icon', this._showIconCombo.get_model().get_value(iter, 0));
        });
        this.append(label);
        this.append(this._showIconCombo);

        //show-error
        let check = new Gtk.CheckButton({
            label: _('Show printer error icon'),
        });
        this._settings.bind('show-error', check, 'active', Gio.SettingsBindFlags.DEFAULT);
        this.append(check);

        //show-jobs
        check = new Gtk.CheckButton({
            label: _('Show documents count next to icon'),
        });
        this._settings.bind('show-jobs', check, 'active', Gio.SettingsBindFlags.DEFAULT);
        this.append(check);

        //job-number
        check = new Gtk.CheckButton({
            label: _('Show each document number on print list'),
        });
        this._settings.bind('job-number', check, 'active', Gio.SettingsBindFlags.DEFAULT);
        this.append(check);

        //send-to-front
        check = new Gtk.CheckButton({
            label: _('Documents can be sent to front'),
        });
        this._settings.bind('send-to-front', check, 'active', Gio.SettingsBindFlags.DEFAULT);
        this.append(check);
        
        this._interfaceCombo.set_active(this._settings.get_enum('connect-to'));
        this._showIconCombo.set_active(this._settings.get_enum('show-icon'));
    }
});

function buildPrefsWidget() {
    return new PrintersPrefsWidget();
}
