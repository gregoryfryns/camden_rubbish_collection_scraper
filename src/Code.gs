const MILLISECONDS_IN_DAY = 24 * 60 * 60 * 1000;

function getServiceIcon(serviceName) {
  let icon;
  const name = serviceName.toLowerCase();
  if (name.includes('food')) {
    icon = '🍌';
  } else if (name.includes('rubbish') || name.includes('refuse')) {
    icon = '🗑️';
  } else if (name.includes('recycling') || name.includes('dmr')) {
    icon = '♻️';
  } else if (name.includes('garden')) {
    icon = '🍂';
  } else {
    icon = '❓';
  }

  return icon;
}

function checkCollectionDays(propertyId) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const url = 'https://recyclingandrubbishcollections.camden.gov.uk/api/getCollectionDays';

  const payload = {
    "pointId": propertyId.toString(),
    "pointType": "PointAddress",
    "councilId": "27"
  };

  const options = {
    'method': 'post',
    'contentType': 'application/json',
    'payload': JSON.stringify(payload),
    'muteHttpExceptions': true
  };

  const response = UrlFetchApp.fetch(url, options);
  const data = JSON.parse(response.getContentText());

  const services = data.activeServices || data.collectionServices;
  const address = (data.propertyInfo && data.propertyInfo.name) || data.address || "Address not provided";

  if (!services) {
    throw new Error(`API error for property ${propertyId}: ${response.getContentText()}`);
  }

  const result = {
    address: address,
    minDelay: 99,
    services: []
  };

  services.forEach(service => {
    if (!service.serviceSchedules) return;

    // Find next collection (Outstanding, Scheduled, Pending, or In Progress)
    const nextSchedule = service.serviceSchedules.find(s =>
      ['Outstanding', 'Scheduled', 'Pending'].includes(s.coreStateName) ||
      (s.state && s.state.toLowerCase().includes('in progress')) ||
      (!s.coreStateName && s.originalScheduledDate && new Date(s.originalScheduledDate) >= today)
    );

    // Find last collection
    const lastSchedule = service.serviceSchedules.find(s =>
      ['Complete', 'Not Done', 'Failed'].includes(s.coreStateName) ||
      (s.state && s.state.toLowerCase().includes('last collection'))
    );

    if (nextSchedule) {
      const nextDateStr = nextSchedule.currentScheduledDate || nextSchedule.originalScheduledDate;
      const nextCollectionDate = new Date(nextDateStr);
      nextCollectionDate.setHours(0, 0, 0, 0);

      const delay = Math.round((nextCollectionDate - today) / MILLISECONDS_IN_DAY);
      result.minDelay = Math.min(delay, result.minDelay);

      const formattedDate = Utilities.formatDate(nextCollectionDate, 'GMT', 'dd/MM/yyyy');

      result.services.push({
        serviceName: service.serviceName,
        serviceIcon: getServiceIcon(service.serviceName),
        last: lastSchedule ? lastSchedule.state || lastSchedule.coreStateName : 'N/A',
        next: formattedDate,
        nextReadable: delay === 1 ? 'tomorrow' : `in ${delay} days`,
        sign: delay === 1 ? '✅' : '❌'
      });
    }
  });

  return result;
}

function sendEmailReminders() {
  for (const el of PROPERTIES_LIST) {
    sendEmailReminder(el.recipients, el.propertyId);
  }
}

function sendEmailReminder(recipients, propertyId) {
  const collectionDays = checkCollectionDays(propertyId);

  if (collectionDays.minDelay !== 1) {
    console.log(`Next collection in ${collectionDays.minDelay} days - skip email.`);
    return
  }

  const htmlBodyDivs = collectionDays.services
    .sort((a, b) => a.next > b.next ? 1 : -1)
    .map(service =>
      `<div style="margin-top: 1em">
          <h4>${service.sign} - ${service.serviceIcon} ${service.serviceName}</h4>
          <div>${service.last}</div>
          <div>Next collection: ${service.next} (${service.nextReadable})</div>
        </div>`
    );

  htmlBodyDivs.push(`<div style="margin-top: 2em">Address: <address>${collectionDays.address}</address></div>`);

  const servicesTomorrow = collectionDays.services
    .filter(service => service.nextReadable == 'tomorrow')
    .map(service => service.serviceIcon);

  const servicesLater = collectionDays.services
    .filter(service => service.nextReadable != 'tomorrow')
    .map(service => service.serviceIcon);

  const hasServicesLater = servicesLater.length > 0;

  const subject = `Trash Collection (✅: ${servicesTomorrow.join('')}${hasServicesLater ? ' - ❌: ' + servicesLater.join('') : ''})`;

  MailApp.sendEmail({
    to: recipients,
    subject,
    htmlBody: htmlBodyDivs.join('')
  });
}